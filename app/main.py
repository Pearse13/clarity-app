from fastapi import FastAPI, Depends, HTTPException, status, Security, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
import logging
import time
import os
# Import models from the app models file
from app.models import TransformResponse, TransformationType
from app.services.openai_service import transform_text_with_gpt
from app.services.context_service import context_extractor
from app.core.security import verify_request, key_manager
from app.core.config import settings
from app.core.logging import app_logger, security_logger
from app.core.rate_limit import RateLimiter
from app.core.middleware import SecurityMiddleware
from app.core.email import send_verification_email, verify_code

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Clarity API",
    description="API for transforming text with context awareness",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add security middleware
app.add_middleware(SecurityMiddleware)

# Initialize rate limiter
rate_limiter = RateLimiter()

# API key authentication
API_KEY = os.getenv("API_KEY", "dev_key")
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

def get_client_host(request: Request) -> str:
    """Safely get client host with fallback to unknown."""
    if request and hasattr(request, 'client') and request.client and hasattr(request.client, 'host'):
        return request.client.host
    return "unknown"

async def get_api_key(api_key: str = Security(api_key_header)):
    if not API_KEY:  # Skip validation if no API key is set (dev mode)
        return True
    if api_key == API_KEY:
        return True
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid API Key",
    )

# Define request models here to avoid conflicts with app.models
class TransformRequest(BaseModel):
    text: str
    transformationType: TransformationType
    level: int
    isLecture: bool = False
    documentText: Optional[str] = None

class EmailVerificationRequest(BaseModel):
    email: str

class VerifyCodeRequest(BaseModel):
    email: str
    code: str

@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all requests and their outcomes"""
    response = await call_next(request)
    
    # Log request details
    request_data = {
        "method": request.method,
        "path": str(request.url.path),
        "client_host": get_client_host(request),
        "user_agent": request.headers.get("user-agent")
    }
    security_logger.log_request(request_data, response.status_code)
    
    return response

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    app_logger.info("Health check requested")
    return {"status": "healthy", "key_rotation_needed": key_manager.should_rotate(), "timestamp": time.time()}

@app.post("/transform", response_model=TransformResponse)
async def transform(request: TransformRequest, authenticated: bool = Depends(get_api_key)):
    """Transform text based on the provided transformation type and level"""
    logger.info(f"Received transform request for type={request.transformationType}, level={request.level}")
    
    try:
        # Extract context if document text is provided
        context = None
        if hasattr(request, 'documentText') and request.documentText:
            context = context_extractor.extract_context(request.documentText, request.text)
            logger.info(f"Extracted context: {len(context.keys()) if context else 0} elements")
        
        # Call the OpenAI service to transform the text
        transformed_text, usage_info = await transform_text_with_gpt(
            text=request.text, 
            transform_type=request.transformationType, 
            level=request.level,
            is_lecture=request.isLecture if hasattr(request, 'isLecture') else False,
            context=context
        )
        
        # Create the response object
        response = TransformResponse(
            transformedText=transformed_text,
            transformationType=request.transformationType,
            level=request.level,
            usage_info=usage_info,
            context_applied=usage_info.get("context_applied", False)
        )
        
        return response
        
    except Exception as e:
        logger.error(f"Error transforming text: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error transforming text: {str(e)}",
        )

@app.post("/send-verification")
async def send_verification(request: EmailVerificationRequest):
    """Send verification code to email."""
    success = send_verification_email(request.email)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to send verification email")
    return {"message": "Verification code sent successfully"}

@app.post("/verify-code")
async def verify_email_code(request: VerifyCodeRequest):
    """Verify the email verification code."""
    if verify_code(request.email, request.code):
        return {"message": "Email verified successfully"}
    raise HTTPException(status_code=400, detail="Invalid or expired verification code")