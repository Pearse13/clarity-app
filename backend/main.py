import sys
import os
from pathlib import Path

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
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from datetime import datetime
from typing import Literal

# Load environment variables based on environment
def load_environment_variables():
    if os.getenv('ENVIRONMENT') == 'production':
        try:
            # If using AWS Secrets Manager
            import boto3
            from botocore.exceptions import ClientError
            
            def get_secret():
                secret_name = "clarity/production"
                region_name = "your-region"
                
                session = boto3.session.Session()
                client = session.client(
                    service_name='secretsmanager',
                    region_name=region_name
                )
                
                try:
                    get_secret_value_response = client.get_secret_value(
                        SecretId=secret_name
                    )
                except ClientError as e:
                    raise e
                else:
                    if 'SecretString' in get_secret_value_response:
                        secret = json.loads(get_secret_value_response['SecretString'])
                        for key, value in secret.items():
                            os.environ[key] = value
                            
            get_secret()
        except Exception as e:
            print(f"Error loading production secrets: {e}")
            raise
    else:
        # Load from .env file in development
        load_dotenv(override=True)  # Add override=True to ensure values are reloaded
        
        # Debug print environment variables
        api_key = os.getenv('OPENAI_API_KEY', '')
        print("Environment loading debug:")
        print(f"API key type: {type(api_key)}")
        print(f"API key length: {len(api_key)}")
        print(f"API key first 10 chars: {api_key[:10]}")
        print(f"API key repr: {repr(api_key)}")
        
        # Clean the API key
        if api_key:
            api_key = api_key.strip()  # Remove any whitespace
            api_key = api_key.replace('\n', '').replace('\r', '')  # Remove any newlines
            os.environ['OPENAI_API_KEY'] = api_key  # Set the cleaned key
            print(f"Cleaned API key first 10 chars: {api_key[:10]}")
            print(f"Cleaned API key repr: {repr(api_key)}")

# Load environment variables before anything else
load_environment_variables()

def create_app():
    # Initialize FastAPI app
    app = FastAPI()

    # Initialize Sentry
    sentry_sdk.init(
        dsn=os.getenv("SENTRY_DSN"),
        traces_sample_rate=1.0,
        environment=os.getenv("ENVIRONMENT", "development"),
        release=os.getenv("SENTRY_RELEASE"),
        send_default_pii=True,
        server_name=os.getenv("VERCEL_URL", "localhost"),
        debug=True,
        integrations=[
            FastApiIntegration(transaction_style="endpoint")
        ],
        before_send=lambda event, hint: {
            **event,
            "timestamp": time.time(),
            "datetime": datetime.utcnow().isoformat()
        } if event else event,
    )

    # Update CORS settings
    allowed_origins = []
    if os.getenv('ENVIRONMENT') == 'production':
        allowed_origins.append(os.getenv('PRODUCTION_DOMAIN'))
    else:
        allowed_origins.extend([
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            "http://localhost:8000",
            "http://127.0.0.1:8000"
        ])

    app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*"])
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
        expose_headers=["*"],
        max_age=3600
    )

    return app

# Create the app instance for direct usage
app = create_app()

# Add this for ASGI factory pattern
def get_application():
    return app

class TransformRequest(BaseModel):
    text: str
    transformationType: Literal["simplify", "sophisticate", "casualise", "formalise"]
    level: int

# Verify OpenAI API key is set
if not os.getenv("OPENAI_API_KEY"):
    raise ValueError("OPENAI_API_KEY environment variable is not set")

# Enhanced OpenAI client initialization with debug logging
print(f"Initializing OpenAI client with key preview: {os.getenv('OPENAI_API_KEY')[:8]}...")
try:
    client = AsyncOpenAI(
        api_key=os.getenv("OPENAI_API_KEY"),
        timeout=30.0,  # Increase timeout
        max_retries=2  # Add retries
    )
    print("OpenAI client initialized successfully")
except Exception as e:
    print(f"Error initializing OpenAI client: {str(e)}")
    raise

def get_transformation_prompt(text: str, transformation_type: str, level: int) -> dict:
    """Get the appropriate prompt for the transformation type and level."""
    prompts = {
        "simplify": {
            "system_role": "You are an expert at simplifying complex text while preserving its core meaning. You adapt content for different comprehension levels with precise vocabulary control.",
            "prompt": f"""Simplify this text to exactly match level {level}/5:

Level Guidelines:
1: Elementary (Age 7-8) - Use only basic words, very short sentences (5-7 words), and explain everything like you're talking to a young child. Break complex ideas into tiny steps.
2: Middle School (Age 11-12) - Use simple words but allow some field-specific terms with explanations. Keep sentences short but can use compound sentences occasionally.
3: High School (Age 14-15) - Use moderate vocabulary, allow field-specific terms, and use a mix of simple and compound sentences. Include brief explanations for complex concepts.
4: College Freshman - Use standard vocabulary with some technical terms. Maintain clarity but don't oversimplify. Use natural sentence structures.
5: General Adult - Keep the language straightforward but don't simplify technical terms. Focus on clarity while maintaining sophistication.

Original text: {text}

Transform this text to exactly match Level {level}, following the guidelines precisely."""
        },
        "sophisticate": {
            "system_role": "You are an expert at elevating text to higher levels of sophistication while maintaining accuracy and enhancing meaning.",
            "prompt": f"""Sophisticate this text to exactly match level {level}/5:

Level Guidelines:
1: Professional - Enhance vocabulary moderately, use proper business language, maintain clarity with slight formality.
2: Academic Undergraduate - Use discipline-specific terminology, complex sentence structures, and scholarly tone. Include theoretical frameworks where relevant.
3: Academic Graduate - Employ advanced theoretical concepts, sophisticated analysis, and field-specific jargon with precise usage.
4: Expert/Specialist - Utilize highly technical language, complex theoretical frameworks, and demonstrate deep domain expertise.
5: Advanced Academic - Use the most sophisticated academic language, complex philosophical concepts, and intricate theoretical analysis. Similar to published papers in top academic journals.

Original text: {text}

Transform this text to exactly match Level {level}, following the guidelines precisely."""
        },
        "casualise": {
            "system_role": "You are an expert at making text more casual and relatable while maintaining its core message and engagement.",
            "prompt": f"""Make this text more casual to exactly match level {level}/5:

Level Guidelines:
1: Polite Casual - Friendly and approachable but still professional. Like talking to a colleague you know well.
2: Relaxed - More informal, using contractions and common expressions. Like talking to a friend.
3: Very Casual - Use everyday language, slang (but keep it clean), and a conversational tone. Like texting a close friend.
4: Super Casual - Heavy use of informal language, modern expressions, and internet-friendly language. Like posting on social media.
5: Ultra Casual - Maximum informality, trending slang, emojis, and extremely conversational tone. Like chatting with your closest friends.

Original text: {text}

Transform this text to exactly match Level {level}, following the guidelines precisely."""
        },
        "formalise": {
            "system_role": "You are an expert at elevating text to appropriate levels of formality while maintaining clarity and professionalism.",
            "prompt": f"""Formalize this text to exactly match level {level}/5:

Level Guidelines:
1: Basic Professional - Clean up casual language, use proper grammar, and maintain a light professional tone. Suitable for general business email.
2: Business Formal - Use proper business language, formal tone, and professional vocabulary. Suitable for business reports and formal communications.
3: Executive Level - Employ sophisticated business language, industry-specific terms, and polished phrasing. Suitable for executive communications.
4: Legal/Corporate - Use precise legal/corporate terminology, complex formal structures, and highly professional tone. Suitable for legal or official documents.
5: Diplomatic/Governmental - Utilize the highest level of formal language, diplomatic phrasing, and institutional terminology. Suitable for diplomatic or high-level government communications.

Original text: {text}

Transform this text to exactly match Level {level}, following the guidelines precisely."""
        }
    }
    return prompts[transformation_type]

# JWT validation
security = HTTPBearer()

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        # Get JWKS from Auth0
        jwks_url = f"https://{os.getenv('AUTH0_DOMAIN')}/.well-known/jwks.json"
        print(f"Fetching JWKS from: {jwks_url}")  # Debug log
        
        if not os.getenv('AUTH0_DOMAIN'):
            print("AUTH0_DOMAIN not set")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Auth0 configuration missing"
            )
            
        async with httpx.AsyncClient() as client:
            try:
                jwks_response = await client.get(jwks_url)
                jwks_response.raise_for_status()  # Raise exception for non-200 responses
                jwks = jwks_response.json()
            except Exception as e:
                print(f"Error fetching JWKS: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error fetching JWKS: {str(e)}"
                )
        
        # Verify token
        try:
            unverified_header = jwt.get_unverified_header(token)
        except Exception as e:
            print(f"Error parsing token header: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token header: {str(e)}"
            )
            
        print(f"Token header: {unverified_header}")  # Debug log
        
        if 'kid' not in unverified_header:
            print("No 'kid' in token header")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token header: no key ID"
            )
            
        rsa_key = None
        for key in jwks.get("keys", []):
            if key.get("kid") == unverified_header["kid"]:
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"]
                }
                break
                
        if not rsa_key:
            print(f"No matching key found for kid: {unverified_header['kid']}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unable to find appropriate key"
            )

        try:
            payload = jwt.decode(
                token,
                rsa_key,
                algorithms=["RS256"],
                audience=os.getenv("AUTH0_AUDIENCE"),
                issuer=f"https://{os.getenv('AUTH0_DOMAIN')}/"
            )
            print(f"Token successfully verified for sub: {payload.get('sub')}")
            return payload
        except JWTError as e:
            print(f"JWT decode error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token: {str(e)}",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected auth error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication error: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN")
AUTH0_CLIENT_ID = os.getenv("AUTH0_CLIENT_ID")
AUTH0_CLIENT_SECRET = os.getenv("AUTH0_CLIENT_SECRET")
AUTH0_CALLBACK_URL = os.getenv("AUTH0_CALLBACK_URL")

@app.post("/transformText")
async def transform_text(request: TransformRequest, token_payload: dict = Depends(verify_token)):
    try:
        # Debug logging
        print(f"Received request: {request}")
        
        # Input sanitization
        text = request.text.strip()
        
        if not text:
            return JSONResponse(
                status_code=400,
                content={"detail": "Text cannot be empty"}
            )
            
        # Check for potential XSS/injection
        if any(char in text for char in "<>{}()[]'\""): 
            return JSONResponse(
                status_code=400,
                content={"detail": "Text contains invalid characters"}
            )

        if len(text) > 250:
            return JSONResponse(
                status_code=400,
                content={"detail": "Text exceeds 250 characters"}
            )
        
        if request.level < 1 or request.level > 5:
            return JSONResponse(
                status_code=400,
                content={"detail": "Level must be between 1 and 5"}
            )

        try:
            # Get transformation prompt
            prompt_data = get_transformation_prompt(text, request.transformationType, request.level)
            
            # Debug logging
            print(f"Sending to OpenAI: {prompt_data}")
            
            # Make OpenAI request
            response = await client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": prompt_data["system_role"]},
                    {"role": "user", "content": prompt_data["prompt"]}
                ],
                temperature=0.7,
                max_tokens=150
            )
            
            transformed_text = response.choices[0].message.content.strip()
            
            # Debug logging
            print(f"OpenAI Response: {transformed_text}")
            
            result = {"transformedText": transformed_text}
            print(f"Sending response: {result}")
            
            return JSONResponse(
                status_code=200,
                content=result
            )
        except Exception as openai_error:
            print(f"OpenAI API error: {str(openai_error)}")
            return JSONResponse(
                status_code=500,
                content={"detail": f"OpenAI API error: {str(openai_error)}"}
            )
            
    except Exception as e:
        error_msg = f"Error in transform_text: {str(e)}"
        print(error_msg)
        return JSONResponse(
            status_code=500,
            content={"detail": error_msg}
        )

@app.get("/")
async def root():
    return {"message": "Clarity API is running"}

@app.get("/health")
async def health_check():
    """Health check endpoint for API monitoring"""
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "clarity-api",
        "version": os.getenv("VERSION", "development")
    }

@app.get("/test-openai")
async def test_openai_connection():
    """Test the connection to OpenAI API"""
    try:
        print("\nTesting OpenAI connection...")
        api_key = os.getenv('OPENAI_API_KEY', '')
        
        # Debug logging
        print("\nAPI Key Debug Info:")
        print(f"Raw key type: {type(api_key)}")
        print(f"Raw key length: {len(api_key) if api_key else 'None'}")
        print(f"Raw key first 10 chars: {api_key[:10] if api_key else 'None'}")
        print(f"Raw key repr: {repr(api_key)}")
        
        # Clean the key
        if api_key:
            api_key = api_key.strip().replace('\n', '').replace('\r', '')
            print("\nCleaned Key Debug Info:")
            print(f"Cleaned key length: {len(api_key)}")
            print(f"Cleaned key first 10 chars: {api_key[:10]}")
            print(f"Cleaned key repr: {repr(api_key)}")
        
        if not api_key:
            return {
                "status": "error",
                "message": "OpenAI API key is not set"
            }
        
        # Test API key format with detailed error
        if not (api_key.startswith('sk-') or api_key.startswith('sk-proj-')):
            return {
                "status": "error",
                "message": f"Invalid API key format. Key should start with 'sk-' or 'sk-proj-'. Found: {api_key[:8]}...",
                "api_key_preview": f"{api_key[:8]}...",
                "debug_info": {
                    "key_length": len(api_key),
                    "first_10_chars": api_key[:10],
                    "key_repr": repr(api_key[:10])
                }
            }
            
        # Make a simple request to OpenAI API
        try:
            response = await client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": "Say hello!"}
                ],
                max_tokens=10
            )
            return {
                "status": "success",
                "message": "Successfully connected to OpenAI API",
                "response": response.choices[0].message.content.strip(),
                "model": "gpt-3.5-turbo",
                "api_key_preview": f"{api_key[:8]}..."
            }
        except Exception as api_error:
            error_str = str(api_error)
            print(f"OpenAI API error details: {error_str}")
            
            # Check for common error types
            if "Incorrect API key provided" in error_str:
                message = "Invalid API key. Please check your OpenAI API key."
            elif "Connection error" in error_str:
                message = "Cannot connect to OpenAI API. Please check your internet connection and firewall settings."
            else:
                message = f"OpenAI API error: {error_str}"
                
            return {
                "status": "error",
                "message": message,
                "error_details": error_str,
                "api_key_preview": f"{api_key[:8]}..."
            }
    except Exception as e:
        print(f"Unexpected error in test_openai: {str(e)}")
        return {
            "status": "error",
            "message": f"Unexpected error: {str(e)}",
            "api_key_preview": f"{os.getenv('OPENAI_API_KEY')[:8]}..."
        }

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
async def callback(code: str, state: str = None):
    try:
        # For SPA, we just return the authorization code
        # The frontend will handle the token exchange
        return {
            "code": code,
            "state": state
        }

    except Exception as e:
        error_msg = str(e)
        print(f"Auth error: {error_msg}")
        return {"error": error_msg}

@app.get("/logout")
async def logout():
    base_url = os.getenv('PRODUCTION_DOMAIN') if os.getenv('ENVIRONMENT') == 'production' else "http://localhost:5174"
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