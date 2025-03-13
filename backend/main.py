import sys
import os
from pathlib import Path
import logging
from logging.handlers import RotatingFileHandler
import sentry_sdk
import re

# Add parent directory to Python path for proper imports
root_dir = Path(__file__).parent.parent
sys.path.append(str(root_dir))

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, RedirectResponse
from dotenv import load_dotenv
import httpx
import json
from jose import jwt, JWTError
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware import Middleware
from starlette.middleware.base import BaseHTTPMiddleware
import base64
from pydantic import BaseModel
from openai import AsyncOpenAI
import time
from datetime import datetime, timedelta
from typing import Literal, List, Dict, DefaultDict, Optional, Any, Mapping, cast
from collections import defaultdict
import asyncio
from app.services.openai_service import transform_text_with_gpt

# Set up logging
log_directory = "logs"
if not os.path.exists(log_directory):
    os.makedirs(log_directory)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        RotatingFileHandler(
            os.path.join(log_directory, "app.log"),
            maxBytes=10000000,  # 10MB
            backupCount=5
        ),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# Load environment variables based on environment
def load_environment_variables() -> None:
    # Load from .env file in development
    load_dotenv(override=True)
    
    # Debug print environment variables
    api_key = os.getenv('OPENAI_API_KEY', '')
    if api_key:
        api_key = api_key.strip()  # Remove any whitespace
        api_key = api_key.replace('\n', '').replace('\r', '')  # Remove any newlines
        os.environ['OPENAI_API_KEY'] = api_key  # Set the cleaned key

# Load environment variables before anything else
load_environment_variables()

# Auth0 configuration with default values
AUTH0_DOMAIN = os.getenv('AUTH0_DOMAIN', '')
AUTH0_CLIENT_ID = os.getenv('AUTH0_CLIENT_ID', '')
AUTH0_CALLBACK_URL = os.getenv('AUTH0_CALLBACK_URL', '')

def create_app() -> FastAPI:
    app = FastAPI()
    
    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Configure static file serving with absolute path
    from fastapi.staticfiles import StaticFiles
    static_dir = Path(__file__).parent / "static"
    static_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/static", StaticFiles(directory=str(static_dir), html=True), name="static")

    # Include routers
    from app.routers import presentations
    app.include_router(presentations.router)

    return app

# Create the app instance for direct usage
app = create_app()

# Add this for ASGI factory pattern
def get_application() -> FastAPI:
    # Initialize FastAPI app
    app = create_app()
    return app

class TransformRequest(BaseModel):
    text: str
    transformationType: Literal["simplify", "sophisticate", "casualise"]
    level: int
    isLecture: bool = False  # New field to identify lecture requests

# Verify OpenAI API key is set
if not os.getenv("OPENAI_API_KEY"):
    raise ValueError("OPENAI_API_KEY environment variable is not set")

# Initialize OpenAI client
client: AsyncOpenAI = AsyncOpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    timeout=30.0,
    max_retries=2
)

# Rate limiting settings
RATE_LIMIT_REQUESTS = 100  # Number of requests allowed
RATE_LIMIT_WINDOW = 3600  # Time window in seconds (1 hour)

# Store for rate limiting - user_id -> list of request timestamps
rate_limit_store: DefaultDict[str, List[datetime]] = defaultdict(list)

# Custom exception for rate limiting
class RateLimitExceededError(Exception):
    """Exception raised when a user exceeds their rate limit."""
    pass

async def check_rate_limit(user_id: str) -> None:
    """Check if user has exceeded rate limit"""
    now = datetime.now()
    user_requests = rate_limit_store[user_id]
    
    # Remove old requests outside the window
    user_requests = [req_time for req_time in user_requests 
                    if now - req_time < timedelta(seconds=RATE_LIMIT_WINDOW)]
    rate_limit_store[user_id] = user_requests
    
    if len(user_requests) >= RATE_LIMIT_REQUESTS:
        oldest_request = min(user_requests)
        reset_time = oldest_request + timedelta(seconds=RATE_LIMIT_WINDOW)
        wait_seconds = (reset_time - now).total_seconds()
        raise RateLimitExceededError(f"Rate limit exceeded. Try again in {int(wait_seconds)} seconds")
    
    # Add current request
    rate_limit_store[user_id].append(now)

def get_transformation_prompt(text: str, transformation_type: str, level: int) -> dict:
    """Get the appropriate prompt for the transformation type and level."""
    prompts = {
        "simplify": {
            "system_role": "You are an expert educator and communicator, skilled at making complex ideas accessible while preserving their essential meaning. You adapt content for different comprehension levels with precise vocabulary control and cognitive development awareness.",
            "prompt": f"""Transform this text to be perfectly understandable at level {level}/5, while maintaining its core meaning and educational value:

Level Guidelines:
1: Age 7-8 - Use foundational vocabulary (1000 most common words), very short sentences (5-7 words), and clear step-by-step explanations. Break complex ideas into digestible pieces. Use concrete examples and avoid abstractions.
2: Age 10-11 - Use grade-appropriate vocabulary with carefully introduced subject-specific terms. Maintain short sentences but allow occasional compound sentences. Include brief explanations for new concepts. Use relatable analogies.
3: Age 13-14 - Employ age-appropriate vocabulary with subject-specific terminology. Balance simple and compound sentences. Introduce abstract concepts gradually with concrete examples. Maintain engagement through clear progression of ideas.
4: GCSE Level - Utilize standard academic vocabulary with technical terms as needed. Natural sentence structures with clear logical flow. Present complex ideas systematically. Include subject-specific context while ensuring accessibility.
5: A-Level - Maintain academic sophistication while prioritizing clarity. Use field-appropriate terminology with precise definitions. Complex ideas presented in structured, digestible format. Focus on building comprehensive understanding.

Original text: {text}

Transform this text to exactly match Level {level}, following these additional requirements:
1. Maintain the core meaning and educational value
2. Use vocabulary and sentence structures precisely matched to the cognitive level
3. Include clear transitions between ideas
4. Add brief explanations for complex terms when needed
5. Ensure the text flows naturally and engages the reader"""
        },
        "sophisticate": {
            "system_role": "You are an expert academic writer and intellectual communicator, skilled at elevating text to higher levels of sophistication while maintaining clarity and precision.",
            "prompt": f"""Elevate this text to sophistication level {level}/5, enhancing its intellectual depth and academic rigor:

Level Guidelines:
1: Professional - Employ business-appropriate language with moderate formality. Use industry-standard terminology and clear, professional sentence structures. Focus on precision and clarity while maintaining a polished tone.
2: Academic Undergraduate - Incorporate scholarly language and theoretical frameworks. Use field-specific terminology with proper context. Develop arguments with supporting evidence and logical progression.
3: Academic Graduate - Utilize advanced theoretical concepts and specialized terminology. Construct complex arguments with nuanced analysis. Demonstrate deep understanding of field-specific methodologies.
4: Expert/Specialist - Deploy sophisticated technical language and complex theoretical frameworks. Present intricate arguments with detailed analysis. Show mastery of advanced concepts and methodologies.
5: Advanced Academic - Employ highest-level academic discourse with philosophical depth. Present complex theoretical syntheses and novel insights. Demonstrate exceptional command of field-specific concepts and methodologies.

Original text: {text}

Transform this text to exactly match Level {level}, following these additional requirements:
1. Elevate the intellectual sophistication while maintaining clarity
2. Use precise, field-appropriate terminology
3. Enhance the logical structure and argumentation
4. Add depth to concepts and ideas
5. Maintain academic rigor and professional tone"""
        },
        "casualise": {
            "system_role": "You are an expert in natural, conversational communication, skilled at making text feel authentic and relatable while maintaining its core message.",
            "prompt": f"""Transform this text to casualness level {level}/5, making it feel natural and conversational:

Level Guidelines:
1: Friendly - Use warm, approachable language with light professional tone. Keep sentence structures natural but polished. Include occasional conversational phrases while maintaining professionalism.
2: Conversational - Adopt a natural speaking style with everyday vocabulary. Use contractions and informal transitions. Balance casual tone with clear communication.
3: Informal - Employ relaxed language with common expressions. Use shorter sentences and natural flow. Include relatable examples and analogies.
4: Casual - Very relaxed tone with everyday phrases and expressions. Use informal vocabulary and natural speech patterns. Make content feel like a friendly conversation.
5: Ultra-Casual - Highly colloquial language with contemporary expressions. Use very informal sentence structures and casual transitions. Make the text feel like a chat with a friend.

Original text: {text}

Transform this text to exactly match Level {level}, following these additional requirements:
1. Maintain the core message while making it more approachable
2. Use natural, conversational language appropriate to the level
3. Include appropriate casual expressions and transitions
4. Keep the flow smooth and engaging
5. Ensure the tone feels authentic and relatable"""
        }
    }
    
    return prompts.get(transformation_type, {
        "system_role": "You are a helpful assistant.",
        "prompt": f"Please transform this text: {text}"
    })

# JWT validation
security = HTTPBearer()

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    token = credentials.credentials
    try:
        # Get JWKS from Auth0
        jwks_url = f"https://{os.getenv('AUTH0_DOMAIN', '')}/.well-known/jwks.json"
        
        if not os.getenv('AUTH0_DOMAIN'):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Auth0 configuration missing"
            )
            
        async with httpx.AsyncClient() as client:
            jwks_response = await client.get(jwks_url)
            jwks = jwks_response.json()
            
            # Extract the key from the token header
            try:
                unverified_header = jwt.get_unverified_header(token)
            except JWTError:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token header"
                )
            
            rsa_key = {}
            for key in jwks["keys"]:
                if key["kid"] == unverified_header["kid"]:
                    rsa_key = {
                        "kty": key["kty"],
                        "kid": key["kid"],
                        "use": key["use"],
                        "n": key["n"],
                        "e": key["e"]
                    }
                    break
                    
            if not rsa_key:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Unable to find appropriate key"
                )
                
            try:
                payload = jwt.decode(
                    token,
                    rsa_key,
                    algorithms=["RS256"],
                    audience=os.getenv('AUTH0_AUDIENCE'),
                    issuer=f"https://{os.getenv('AUTH0_DOMAIN', '')}/"
                )
                return dict(payload)  # Explicitly convert to dict
            except JWTError as e:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Invalid token: {str(e)}"
                )
                
    except httpx.RequestError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to fetch JWKS"
        )

# Function to determine which model to use based on transformation type and level
def get_model_for_transformation(transformation_type: str, level: int) -> str:
    if transformation_type == "simplify":
        return "gpt-3.5-turbo" if level <= 3 else "gpt-4"
    elif transformation_type in ["sophisticate", "casualise"]:
        return "gpt-3.5-turbo" if level <= 2 else "gpt-4"
    # Default to GPT-4 for any case not handled above
    return "gpt-4"

@app.post("/transformText")
async def transform_text(request: TransformRequest, token_payload: dict = Depends(verify_token)):
    start_time = time.time()
    
    # Get user ID from token with default value
    user_id = token_payload.get("sub", "anonymous")  # Provide default value
    
    # Apply rate limiting
    try:
        await check_rate_limit(user_id)
    except RateLimitExceededError as e:
        raise HTTPException(status_code=429, detail=str(e))
    
    # Log transformation request
    logging.info(f"Transform request - User: {user_id}, Type: {request.transformationType}, Level: {request.level}")
    
    try:
        # Get transformation prompt
        prompt_data = get_transformation_prompt(request.text, request.transformationType, request.level)
        
        # Call OpenAI API with the determined model
        response = await client.chat.completions.create(
            model=get_model_for_transformation(request.transformationType, request.level),
            messages=prompt_data["messages"],
            temperature=0.7,
            max_tokens=1000,
            top_p=1.0,
            frequency_penalty=0.0,
            presence_penalty=0.0
        )
        
        transformed_text = response.choices[0].message.content if response.choices else ""
        
        # Ensure we're only returning the selected level for lecture requests
        if request.isLecture and transformed_text:
            # Check if the text contains level prefixes and extract just the requested level
            level_pattern = re.compile(r'level:\s*(\d+)\s*(.*?)(?=level:\s*\d+|\Z)', re.DOTALL | re.IGNORECASE)
            matches = level_pattern.findall(transformed_text)
            
            if matches:
                # Look for exact level match
                for level_str, content in matches:
                    if int(level_str) == request.level:
                        transformed_text = content.strip()
                        break
                else:
                    # If we didn't find an exact match, just return the cleaned text
                    transformed_text = re.sub(r'level:\s*\d+\s*', '', transformed_text, flags=re.IGNORECASE)
        
        # Calculate usage statistics with null checks
        usage = response.usage if response else None
        prompt_tokens = usage.prompt_tokens if usage else 0
        completion_tokens = usage.completion_tokens if usage else 0
        total_tokens = usage.total_tokens if usage else 0
        
        # Log transformation completion
        logging.info(f"Transform complete - User: {user_id}, Tokens: {total_tokens}")
        
        # Record processing time
        processing_time = time.time() - start_time
        logging.info(f"Processing time: {processing_time:.2f}s")
        
        # Return transformed text with usage statistics
        return {
            "transformedText": transformed_text,
            "originalText": request.text,
            "transformationType": request.transformationType,
            "level": request.level,
            "model": get_model_for_transformation(request.transformationType, request.level),
            "usage": {
                "promptTokens": prompt_tokens,
                "completionTokens": completion_tokens,
                "totalTokens": total_tokens
            }
        }
    except Exception as e:
        # Log error
        logging.error(f"Error in transformation - User: {user_id}, Error: {str(e)}")
        
        # Report to Sentry if available
        sentry_sdk.capture_exception(e)
        
        # Return error message
        raise HTTPException(status_code=500, detail=f"Error transforming text: {str(e)}")

@app.get("/")
async def root():
    return {"message": "Welcome to the Clarity API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

@app.get("/test-openai")
async def test_openai_connection():
    """Test OpenAI API connection with both GPT-3.5 and GPT-4"""
    try:
        logger.info("Testing OpenAI connection with both models...")
        
        # Test GPT-3.5
        gpt35_response = await client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a test assistant."},
                {"role": "user", "content": "Respond with 'GPT-3.5 connection successful!' if you receive this message."}
            ],
            temperature=0.7
        )
        
        # Test GPT-4
        gpt4_response = await client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a test assistant."},
                {"role": "user", "content": "Respond with 'GPT-4 connection successful!' if you receive this message."}
            ],
            temperature=0.7
        )
        
        logger.info("OpenAI test successful for both models")
        
        # Safely get usage data with type checking
        gpt35_usage = {}
        gpt4_usage = {}
        
        if gpt35_response and gpt35_response.usage:
            try:
                gpt35_usage = dict(gpt35_response.usage)
            except (AttributeError, TypeError):
                pass
                
        if gpt4_response and gpt4_response.usage:
            try:
                gpt4_usage = dict(gpt4_response.usage)
            except (AttributeError, TypeError):
                pass
        
        # Safely get response content with type checking
        gpt35_content = ""
        if (gpt35_response and gpt35_response.choices and 
            gpt35_response.choices[0].message and 
            isinstance(gpt35_response.choices[0].message.content, str)):
            gpt35_content = gpt35_response.choices[0].message.content
            
        gpt4_content = ""
        if (gpt4_response and gpt4_response.choices and 
            gpt4_response.choices[0].message and 
            isinstance(gpt4_response.choices[0].message.content, str)):
            gpt4_content = gpt4_response.choices[0].message.content
        
        return {
            "status": "success",
            "message": "OpenAI connection test successful for both models",
            "gpt35": {
                "model": "gpt-3.5-turbo",
                "response": gpt35_content,
                "usage": gpt35_usage
            },
            "gpt4": {
                "model": "gpt-4",
                "response": gpt4_content,
                "usage": gpt4_usage
            }
        }
    except Exception as e:
        logger.error(f"OpenAI test failed: {str(e)}")
        if hasattr(e, '__cause__'):
            logger.error(f"Caused by: {str(e.__cause__)}")
        raise HTTPException(status_code=500, detail=f"OpenAI test failed: {str(e)}")

@app.get("/sentry-debug")
async def trigger_error():
    try:
        # First send a test message
        sentry_sdk.capture_message("Testing Sentry integration")
        print("Sent test message to Sentry")
        
        # Then trigger a division by zero error
        division_by_zero = 1 / 0
        return {"status": "This should not be reached"}
    except Exception as e:
        sentry_sdk.capture_exception(e)
        print(f"Caught error: {str(e)}")
        return {"status": "error", "message": "Test error sent to Sentry", "error": str(e)}

@app.get("/login")
async def login():
    """Initiate login by redirecting to Auth0"""
    auth_url = f"https://{AUTH0_DOMAIN}/authorize"
    params = {
        "response_type": "code",
        "client_id": AUTH0_CLIENT_ID,
        "redirect_uri": AUTH0_CALLBACK_URL,
        "scope": "openid profile email",
        "audience": os.getenv('AUTH0_AUDIENCE'),
        "state": base64.b64encode(os.urandom(32)).decode('utf-8')
    }
    
    # Build the query string
    query_string = "&".join(f"{k}={v}" for k, v in params.items())
    auth_url = f"{auth_url}?{query_string}"
    
    # Use status_code 303 to ensure redirect works with all browsers
    return RedirectResponse(url=auth_url, status_code=303)

@app.get("/callback")
async def callback(code: str, state: Optional[str] = None):
    try:
        # For SPA, we just return the authorization code
        # The frontend will handle the token exchange
        return {
            "code": code,
            "state": state or ""  # Use or operator for cleaner null coalescing
        }

    except Exception as e:
        error_msg = str(e)
        print(f"Auth error: {error_msg}")
        return {"error": error_msg}

@app.get("/logout")
async def logout():
    """Initiate logout by redirecting to Auth0"""
    if not AUTH0_DOMAIN:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Auth0 configuration missing"
        )
        
    base_url = os.getenv('PRODUCTION_DOMAIN', 'localhost:5174')
    response = RedirectResponse(
        url=f"https://{AUTH0_DOMAIN}/v2/logout?"
        f"client_id={AUTH0_CLIENT_ID}&"
        f"returnTo={base_url}"
    )
    response.delete_cookie(
        key="auth_token",
        path="/",
        secure=os.getenv('ENVIRONMENT') == 'production',
        httponly=True
    )
    return response

# Make sure app is defined at module level
__all__ = ['app']

# Add this at the end of the file
if __name__ == "__main__":
    import uvicorn
    print("Starting Clarity API server...")
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="debug"
    )
    print("Server running at http://localhost:8000")