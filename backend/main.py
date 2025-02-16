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
        load_dotenv()

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
        debug=True,  # Enable debug mode temporarily
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

class TransformRequest(BaseModel):
    text: str
    transformationType: str
    level: int

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# JWT validation
security = HTTPBearer()

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        # Get JWKS from Auth0
        jwks_url = f"https://{os.getenv('AUTH0_DOMAIN')}/.well-known/jwks.json"
        print(f"Fetching JWKS from: {jwks_url}")  # Debug log
        async with httpx.AsyncClient() as client:
            jwks = await client.get(jwks_url)
            jwks = jwks.json()
        
        # Verify token
        unverified_header = jwt.get_unverified_header(token)
        print(f"Token header: {unverified_header}")  # Debug log
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
        if rsa_key:
            try:
                payload = jwt.decode(
                    token,
                    rsa_key,
                    algorithms=["RS256"],
                    audience=os.getenv("AUTH0_AUDIENCE"),
                    issuer=f"https://{os.getenv('AUTH0_DOMAIN')}/"
                )
                return payload
            except JWTError as e:
                print(f"JWT decode error: {str(e)}")  # Debug log
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Invalid authentication credentials: {str(e)}",
                    headers={"WWW-Authenticate": "Bearer"},
                )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to find appropriate key",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        print(f"Auth error: {str(e)}")  # Debug log
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )

AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN")
AUTH0_CLIENT_ID = os.getenv("AUTH0_CLIENT_ID")
AUTH0_CLIENT_SECRET = os.getenv("AUTH0_CLIENT_SECRET")
AUTH0_CALLBACK_URL = os.getenv("AUTH0_CALLBACK_URL")

def get_transformation_prompt(text: str, transformation_type: str, level: int) -> dict:
    prompts = {
        "simplify": {
            "system_role": "You are an expert at simplifying text while preserving its core meaning.",
            "prompt": f"Simplify this text to level {level}/5 (1 being most simple): {text}"
        },
        "sophisticate": {
            "system_role": "You are an expert at making text more sophisticated while preserving its core meaning.",
            "prompt": f"Make this text more sophisticated to level {level}/5 (5 being most sophisticated): {text}"
        },
        "casualise": {
            "system_role": "You are an expert at making text more casual and conversational.",
            "prompt": f"Make this text more casual to level {level}/5 (5 being most casual): {text}"
        },
        "formalise": {
            "system_role": "You are an expert at making text more formal and professional.",
            "prompt": f"Make this text more formal to level {level}/5 (5 being most formal): {text}"
        }
    }
    return prompts[transformation_type]

@app.post("/transformText")
async def transform_text(request: TransformRequest, token_payload: dict = Depends(verify_token)):
    with sentry_sdk.start_span(op="transform_text") as span:
        try:
            # Input sanitization
            text = request.text.strip()
            span.set_data("text_length", len(text))
            span.set_data("transformation_type", request.transformationType)
            
            if not text:
                raise HTTPException(status_code=400, detail="Text cannot be empty")
                
            # Check for potential XSS/injection
            if any(char in text for char in "<>{}()[]'\""): 
                raise HTTPException(status_code=400, detail="Text contains invalid characters")

            if len(text) > 250:
                raise HTTPException(status_code=400, detail="Text exceeds 250 characters")
            
            if request.level < 1 or request.level > 5:
                raise HTTPException(status_code=400, detail="Level must be between 1 and 5")
                
            if request.transformationType not in ["simplify", "sophisticate", "casualise", "formalise"]:
                raise HTTPException(status_code=400, detail="Invalid transformation type")

            # Rate limit per user (using token sub)
            user_id = token_payload.get('sub', 'anonymous')
            current_minute = int(time.time() / 60)
            rate_key = f"rate_limit:{user_id}:{current_minute}"
            
            with sentry_sdk.start_span(op="openai_request") as openai_span:
                prompt_data = get_transformation_prompt(text, request.transformationType, request.level)
                openai_span.set_data("model", "gpt-3.5-turbo")
                
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
                openai_span.set_data("response_length", len(transformed_text))
                
                return {"transformedText": transformed_text}
            
        except Exception as e:
            sentry_sdk.capture_exception(e)
            raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    return {"message": "Clarity API is running"}

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