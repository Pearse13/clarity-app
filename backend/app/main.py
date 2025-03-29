from fastapi import FastAPI, Request, Response, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pathlib import Path
import logging
import os
import shutil
from datetime import datetime

# Import routers individually to avoid unknown import symbols
from app.routers import presentations
from app.routers import documents
from app.routers import chat

from .models import TransformRequest, TransformResponse, TransformationType
from .services.openai_service import transform_text_with_gpt, call_openai_api
from pydantic import BaseModel
from typing import Optional, Dict, Any, List, cast
from dotenv import load_dotenv
import traceback

# Load environment variables
load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.DEBUG)

def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Clarity API",
        description="API for the Clarity educational tool",
        version="1.0.0"
    )

    # Configure CORS with more specific settings
    origins = [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://clarity-app-beta.vercel.app",
        "https://clarity-app-pearse13.vercel.app",
        "*"  # Temporarily allow all origins
    ]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"]
    )
    
    # Configure static file serving
    static_dir = Path("data/static")
    static_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

    # Include routers with proper error handling and logging
    try:
        app.include_router(presentations.router)
        logger.info("Presentations router included successfully")
    except Exception as e:
        logger.error(f"Error including presentations router: {str(e)}")
        logger.error(traceback.format_exc())

    try:
        app.include_router(documents.router)
        logger.info("Documents router included successfully")
    except Exception as e:
        logger.error(f"Error including documents router: {str(e)}")
        logger.error(traceback.format_exc())

    try:
        app.include_router(chat.router)
        logger.info("Chat router included successfully at /api/chat")
    except Exception as e:
        logger.error(f"Error including chat router: {str(e)}")
        logger.error(traceback.format_exc())

    return app

# Create the application instance
app = create_app()

# Add global exception handler with detailed logging
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception in {request.method} {request.url}")
    logger.error(f"Exception type: {type(exc)}")
    logger.error(f"Exception message: {str(exc)}")
    logger.error(f"Traceback: {traceback.format_exc()}")
    
    # Log request details for debugging
    logger.error(f"Request headers: {dict(request.headers)}")
    logger.error(f"Request query params: {dict(request.query_params)}")
    
    return Response(
        status_code=500,
        content="Internal Server Error: An unexpected error occurred. Please try again later.",
        media_type="text/plain"
    )

@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Incoming request: {request.method} {request.url}")
    logger.debug(f"Request headers: {dict(request.headers)}")
    
    try:
        response = await call_next(request)
        logger.info(f"Response status: {response.status_code}")
        return response
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        raise

@app.get("/")
async def root():
    """Root endpoint for API status check"""
    return {
        "status": "running",
        "version": "1.0.0",
        "documentation": "/docs",
        "endpoints": {
            "health": "/health",
            "chat": "/api/chat",
            "transform": "/api/transform"
        }
    }

@app.get("/health")
async def health_check():
    """Basic health check endpoint"""
    try:
        return {
            "status": "healthy",
            "timestamp": str(datetime.now())
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": str(datetime.now())
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
            logger.warning("Transform request with empty text")
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        
        logger.info(f"Transform request - Type: {request.transformationType}, Level: {request.level}, isLecture: {request.isLecture}, hasDocumentText: {request.documentText is not None}")
        
        try:
            # Log the full request details for debugging
            logger.debug(f"Transform request details:")
            logger.debug(f"- Text length: {len(request.text)} chars")
            logger.debug(f"- Text preview: {request.text[:100]}...")
            logger.debug(f"- isLecture: {request.isLecture}")
            logger.debug(f"- documentText: {request.documentText is not None}")
            
            result = await transform_text_with_gpt(
                text=request.text,
                transform_type=request.transformationType,
                level=request.level,
                is_lecture=request.isLecture,
                document_text=request.documentText
            )
            
            logger.info("Transform complete")
            logger.debug(f"Transform result: {result}")
            return result
            
        except HTTPException as e:
            logger.error(f"HTTP Exception in transform: {e.status_code} - {e.detail}")
            raise
        except Exception as e:
            logger.error(f"Error transforming text: {str(e)}")
            logger.error(f"Error details: {type(e).__name__}")
            logger.error(f"Stack trace: {traceback.format_exc()}")
            raise HTTPException(
                status_code=500,
                detail=f"Error transforming text: {str(e)}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        logger.error(f"Stack trace: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred"
        )

# Ensure upload directory exists
upload_dir = Path("data/uploads")
upload_dir.mkdir(parents=True, exist_ok=True)
logger.info(f"Upload directory initialized at: {upload_dir}")