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
    
    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Add middleware for security headers
    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        # Allow iframe embedding from localhost
        if request.url.hostname in ['localhost', '127.0.0.1']:
            response.headers["X-Frame-Options"] = "ALLOW-FROM http://localhost:5174 http://localhost:8000"
            # Add more permissive CSP for static files
            if request.url.path.startswith('/static/'):
                response.headers["Content-Security-Policy"] = (
                    "default-src 'self' 'unsafe-inline' http://localhost:* data:; "
                    "style-src 'self' 'unsafe-inline'; "
                    "script-src 'self' 'unsafe-inline'; "
                    "frame-ancestors http://localhost:5174 http://localhost:8000; "
                    "img-src 'self' data: blob:; "
                    "font-src 'self' data:; "
                    "object-src 'none'"
                )
                response.headers["Access-Control-Allow-Origin"] = "http://localhost:5174"
                # Remove the DENY header for static files
                if "X-Frame-Options" in response.headers:
                    del response.headers["X-Frame-Options"]
            else:
                response.headers["Content-Security-Policy"] = "frame-ancestors http://localhost:5174 http://localhost:8000"
        else:
            response.headers["X-Frame-Options"] = "SAMEORIGIN"
            response.headers["Content-Security-Policy"] = "frame-ancestors 'self'"
        return response

    # Set up data directories using absolute paths
    backend_dir = Path(__file__).parent.parent.parent.absolute()
    backend_data_dir = backend_dir / "backend" / "data"
    static_dir = backend_data_dir / "static"
    temp_dir = backend_data_dir / "temp"
    presentations_dir = static_dir / "presentations"
    
    # Create directories if they don't exist (don't clean existing ones)
    for dir_path in [static_dir, temp_dir, presentations_dir]:
        dir_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"Ensuring directory exists: {dir_path}")
    
    # Mount static files directory with HTML support
    app.mount("/static", StaticFiles(directory=str(static_dir), html=True), name="static")
    
    # Log directory paths for debugging
    logger.info(f"Backend directory: {backend_dir}")
    logger.info(f"Static directory: {static_dir}")
    logger.info(f"Static directory exists: {static_dir.exists()}")
    logger.info(f"Static directory contents: {list(static_dir.glob('**/*'))}")
    
    # Include routers
    app.include_router(presentations.router)
    
    # Add security middleware
    app.add_middleware(SecurityMiddleware)

    # Initialize rate limiter
    rate_limiter = RateLimiter()
    
    return app

# Create FastAPI app
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
    return {
        "name": "Clarity API",
        "status": "running",
        "version": "1.0.0",
        "documentation": "/docs",
        "health": "/health"
    }

@app.get("/health")
async def health_check():
    try:
        # Check if LibreOffice is accessible
        import subprocess
        import os
        
        # Determine the command based on OS
        if os.name == 'nt':  # Windows
            cmd = ['where', 'soffice']
        else:  # Linux/Unix
            cmd = ['which', 'soffice']
        
        # Run the command to check if LibreOffice is in PATH
        result = subprocess.run(cmd, capture_output=True, text=True)
        libreoffice_status = "available" if result.returncode == 0 else "not found"
        
        # Check OpenAI API key
        openai_key = os.getenv("OPENAI_API_KEY", "")
        openai_status = "configured" if openai_key and len(openai_key) > 20 else "missing or invalid"
        
        # Check data directories
        backend_dir = Path(__file__).parent.parent.parent.absolute()
        backend_data_dir = backend_dir / "data"
        static_dir = backend_data_dir / "static"
        temp_dir = backend_data_dir / "temp"
        
        directories_status = {
            "static": static_dir.exists(),
            "temp": temp_dir.exists(),
            "presentations": (static_dir / "presentations").exists()
        }
        
        return {
            "status": "healthy",
            "libreoffice": libreoffice_status,
            "openai_api": openai_status,
            "directories": directories_status,
            "environment": os.getenv("ENVIRONMENT", "not set")
        }
    except Exception as e:
        logger.error(f"Health check error: {str(e)}")
        return {
            "status": "unhealthy",
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