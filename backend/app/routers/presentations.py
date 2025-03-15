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
import os

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

# Ensure data directories exist
def ensure_directories():
    """Ensure all required directories exist"""
    data_dir = Path("data")
    temp_dir = data_dir / "temp"
    documents_dir = data_dir / "documents"
    
    for directory in [data_dir, temp_dir, documents_dir]:
        directory.mkdir(parents=True, exist_ok=True)
        logger.debug(f"Ensured directory exists: {directory}")

# Call this at module initialization
ensure_directories()

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
        
        # Ensure directories exist
        ensure_directories()
        
        # Create directories for this document
        temp_dir = Path("data/temp")
        output_dir = Path(f"data/documents/{doc_id}")
        temp_dir.mkdir(parents=True, exist_ok=True)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Log directory permissions and existence
        logger.debug(f"Temp directory exists: {temp_dir.exists()}, writable: {os.access(str(temp_dir), os.W_OK)}")
        logger.debug(f"Output directory exists: {output_dir.exists()}, writable: {os.access(str(output_dir), os.W_OK)}")
        
        # Save uploaded file with error handling
        input_path = temp_dir / f"{doc_id}{file_ext}"
        try:
            # Read file content first to avoid potential streaming issues
            file_content = await file.read()
            
            # Write to file
            with open(input_path, "wb") as buffer:
                buffer.write(file_content)
                
            # Verify file was written correctly
            if not input_path.exists() or input_path.stat().st_size == 0:
                raise IOError(f"File was not written correctly to {input_path}")
                
            logger.info(f"File saved to {input_path}, size: {input_path.stat().st_size} bytes")
        except Exception as e:
            logger.error(f"Error saving file: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {str(e)}")
        
        # Create initial status file
        status_file = output_dir / "status.json"
        with open(status_file, "w") as f:
            json.dump({
                "document_id": doc_id,
                "status": "processing",
                "progress": 0,
                "filename": file.filename
            }, f)
        
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