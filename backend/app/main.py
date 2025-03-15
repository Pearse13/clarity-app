from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import logging
import os
import shutil
from .routers import presentations
from .models import TransformRequest, TransformResponse, TransformationType
from .services.openai_service import transform_text_with_gpt, call_openai_api
from pydantic import BaseModel
from typing import Optional, Dict, Any, List, cast
from dotenv import load_dotenv
from app.core.security import verify_request, key_manager
from app.core.config import settings
from app.core.rate_limit import rate_limiter
from app.core.middleware import SecurityMiddleware
from app.core.logging import app_logger, security_logger
from app.core.rate_limit import RateLimiter
from app.core.email import send_verification_email, verify_code
from openai import AsyncOpenAI
from openai.types.chat import ChatCompletion
from datetime import datetime

# Load environment variables
load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.DEBUG)

# Initialize OpenAI client
client = AsyncOpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    timeout=30.0,
    max_retries=2
)

def create_app() -> FastAPI:
    app = FastAPI(
        title="Clarity API",
        description="API for transforming text between different complexity levels",
        version="1.0.0"
    )
    
    # Configure CORS with more permissive settings for development
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Allow all origins temporarily for debugging
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"]
    )
    
    # Add security middleware
    app.add_middleware(SecurityMiddleware)
    
    # Create data directories if they don't exist
    data_dir = Path("data")
    static_dir = data_dir / "static"
    documents_dir = data_dir / "documents"
    temp_dir = data_dir / "temp"
    
    for directory in [data_dir, static_dir, documents_dir, temp_dir]:
        directory.mkdir(parents=True, exist_ok=True)
        logger.info(f"Ensured directory exists: {directory}")
    
    # Mount static files directory
    app.mount("/static", StaticFiles(directory="data/static"), name="static")
    
    # Mount documents directory for direct file access
    app.mount("/documents", StaticFiles(directory="data/documents"), name="documents")
    
    # Include routers
    app.include_router(presentations.router)
    
    return app

app = create_app()

# Add global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {str(exc)}")
    return Response(
        status_code=500,
        content=f"Internal Server Error: An unexpected error occurred. Please try again later.",
        media_type="text/plain"
    )

@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Incoming request: {request.method} {request.url}")
    logger.info(f"Client host: {get_client_host(request)}")
    logger.info(f"Headers: {dict(request.headers)}")
    response = await call_next(request)
    return response

@app.get("/")
async def root():
    try:
        # Simple response that doesn't depend on any external services
        return {
            "name": "Clarity API",
            "status": "running",
            "version": "1.0.0",
            "documentation": "/docs",
            "health": "/health",
            "timestamp": str(datetime.now())
        }
    except Exception as e:
        logger.error(f"Error in root endpoint: {str(e)}")
        # Return a simple response even if there's an error
        return {"status": "running"}

@app.get("/health")
async def health_check():
    try:
        # Simple health check that doesn't depend on external services
        return {
            "status": "healthy",
            "timestamp": str(datetime.now())
        }
    except Exception as e:
        logger.error(f"Health check error: {str(e)}")
        # Always return a response even if there's an error
        return {
            "status": "responding",
            "error": str(e)
        }

class EmailVerificationRequest(BaseModel):
    email: str

class VerifyCodeRequest(BaseModel):
    email: str
    code: str

@app.post("/api/transform")
async def transform_text(request: TransformRequest):
    """Transform text using GPT based on the specified parameters"""
    try:
        if not request.text:
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        
        logger.info(f"Transform request - Type: {request.transformationType}, Level: {request.level}")
        
        try:
            result = await transform_text_with_gpt(
                text=request.text,
                transform_type=request.transformationType,
                level=request.level,
                is_lecture=False
            )
            
            logger.info("Transform complete")
            return result
            
        except HTTPException as e:
            # Re-raise HTTP exceptions from the service
            raise
        except Exception as e:
            logger.error(f"Error transforming text: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Error transforming text: {str(e)}"
            )
            
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred"
        )

def get_client_host(request: Request) -> str:
    """Safely get client host with fallback to unknown."""
    if request and request.client and hasattr(request.client, 'host'):
        return request.client.host
    return "unknown"

@app.post("/test-openai")
async def test_openai_connection():
    """Test OpenAI API connection with both models"""
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
        
        # Safely get response content and usage data
        gpt35_content = gpt35_response.choices[0].message.content if gpt35_response.choices else ""
        gpt4_content = gpt4_response.choices[0].message.content if gpt4_response.choices else ""
        
        gpt35_usage = gpt35_response.usage.model_dump() if gpt35_response.usage else {}
        gpt4_usage = gpt4_response.usage.model_dump() if gpt4_response.usage else {}
        
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

# Log startup information
@app.on_event("startup")
async def startup_event():
    logger.info("Starting application...")
    backend_data_dir = Path(__file__).parent.parent.parent / "backend" / "data"
    logger.info(f"Data directory: {backend_data_dir}")
    logger.info("CORS enabled for: http://localhost:5174") 