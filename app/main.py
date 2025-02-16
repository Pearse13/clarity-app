from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
from dotenv import load_dotenv
import os
from app.services.openai_service import transform_text_with_gpt
from app.models import TransformationType
from app.core.security import verify_request, key_manager
from app.core.config import settings
from app.core.rate_limit import rate_limiter
from app.core.middleware import SecurityMiddleware
from app.core.logging import app_logger, security_logger
from app.core.rate_limit import RateLimiter
from app.core.email import send_verification_email, verify_code

# Load environment variables
load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.DEBUG)

app = FastAPI(
    title="Clarity API",
    description="API for transforming text between different complexity levels",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add security middleware
app.add_middleware(SecurityMiddleware)

# Initialize rate limiter
rate_limiter = RateLimiter()

class TransformRequest(BaseModel):
    text: str
    transformationType: str
    level: int

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
        "client_host": request.client.host,
        "user_agent": request.headers.get("user-agent")
    }
    security_logger.log_request(request_data, response.status_code)
    
    return response

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    app_logger.info("Health check requested")
    return {"status": "healthy", "key_rotation_needed": key_manager.should_rotate()}

@app.post("/transform")
async def transform(request: Request):
    """Transform text endpoint with enhanced security"""
    # Verify request origin
    authorized = await verify_request(request)
    if not authorized:
        security_logger.log_security_event("unauthorized_request", {
            "client_host": request.client.host
        })
        return Response(status_code=403, content="Unauthorized")
    
    # Check rate limit
    rate_limit_info = rate_limiter.check_rate_limit(request.client.host, request)
    if not rate_limit_info[0]:
        security_logger.log_security_event("rate_limit_exceeded", {
            "client_host": request.client.host,
            "limit_info": rate_limit_info[1]
        })
        return Response(status_code=429, content="Rate limit exceeded")
    
    try:
        # Get request body
        data = await request.json()
        
        # Transform text
        result = await transform_text_with_gpt(
            data.get("text"),
            TransformationType(data.get("transformationType")),
            data.get("level")
        )
        
        app_logger.info(f"Successfully transformed text for {request.client.host}")
        return result
        
    except Exception as e:
        app_logger.error(f"Error transforming text: {str(e)}")
        return Response(status_code=500, content="Internal server error")

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