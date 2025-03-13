from fastapi import APIRouter, UploadFile, HTTPException, Request, BackgroundTasks
from ..services.presentation_service import PresentationService
import logging
import shutil
from pathlib import Path
import tempfile
import asyncio
from fastapi.responses import JSONResponse, FileResponse
import sys
import traceback
import uuid
import json

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)  # Ensure debug logging is enabled

# Initialize router
router = APIRouter(prefix="/api/presentations", tags=["presentations"])

# Initialize presentation service
presentation_service = PresentationService()

SUPPORTED_FILE_TYPES = {
    '.ppt': 'PowerPoint',
    '.pptx': 'PowerPoint',
    '.doc': 'Word',
    '.docx': 'Word',
    '.pdf': 'PDF'
}

CHUNK_SIZE = 1024 * 1024  # 1MB chunks

@router.post("/upload")
async def upload_presentation(
    request: Request,
    file: UploadFile,
    background_tasks: BackgroundTasks
) -> JSONResponse:
    """Upload and convert a document to PDF with selectable text"""
    try:
        # Enhanced request logging
        logger.debug("=== Upload Request Details ===")
        logger.debug(f"File object: {file}")
        logger.debug(f"Filename: {file.filename}")
        logger.debug(f"Content type: {file.content_type}")
        logger.debug(f"Headers: {dict(request.headers)}")
        logger.debug(f"File size: {request.headers.get('content-length', 'unknown')} bytes")
        
        # Validate file object
        if not file:
            logger.error("No file object provided")
            raise HTTPException(status_code=400, detail="No file provided")
            
        # Validate filename
        if not file.filename:
            logger.error("No filename provided")
            raise HTTPException(status_code=400, detail="No filename provided")
            
        # Get and validate file extension
        try:
            file_ext = '.' + file.filename.lower().split('.')[-1]
            logger.debug(f"File extension: {file_ext}")
        except Exception as e:
            logger.error(f"Error extracting file extension: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid filename format")
        
        # Validate file type
        if file_ext not in SUPPORTED_FILE_TYPES:
            logger.error(f"Unsupported file type: {file_ext}")
            supported_types = ', '.join(SUPPORTED_FILE_TYPES.values())
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type. Supported types are: {supported_types}"
            )
        
        # Generate unique ID
        doc_id = str(uuid.uuid4())
        
        # Create directories
        temp_dir = Path("data/temp")
        output_dir = Path(f"data/documents/{doc_id}")
        temp_dir.mkdir(parents=True, exist_ok=True)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Save uploaded file
        input_path = temp_dir / f"{doc_id}{file_ext}"
        with open(input_path, "wb") as buffer:
            buffer.write(await file.read())
        
        logger.info(f"File saved to {input_path}, starting processing")
        
        # Start processing in background
        background_tasks.add_task(
            presentation_service.process_presentation, 
            str(input_path), 
            str(output_dir),
            doc_id
        )
        
        return JSONResponse(content={
            "document_id": doc_id,
            "status": "processing",
            "check_status_url": f"/api/presentations/status/{doc_id}"
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in upload_presentation: {str(e)}")
        logger.error(f"Stack trace: {''.join(traceback.format_exception(*sys.exc_info()))}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.get("/status/{doc_id}")
async def check_status(doc_id: str) -> JSONResponse:
    """Check the status of a document conversion"""
    try:
        status_file = Path(f"data/documents/{doc_id}/status.json")
        
        if not status_file.exists():
            return JSONResponse(content={"status": "not_found", "document_id": doc_id})
        
        with open(status_file, "r") as f:
            status_data = json.load(f)
            
        return JSONResponse(content=status_data)
        
    except Exception as e:
        logger.error(f"Error checking status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to check status: {str(e)}")

@router.get("/files/{doc_id}/{filename}")
async def get_document_file(doc_id: str, filename: str):
    """Get a file associated with a document"""
    try:
        file_path = Path(f"data/documents/{doc_id}/{filename}")
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
            
        # Determine content type
        content_type = "application/pdf"  # Default for PDF
        if filename.endswith(".html"):
            content_type = "text/html"
        elif filename.endswith(".txt"):
            content_type = "text/plain"
            
        # Return file as response
        return FileResponse(
            path=file_path,
            media_type=content_type,
            filename=filename
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve file: {str(e)}") 