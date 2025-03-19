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
from ..core.config import settings

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

def ensure_upload_directory():
    """Ensure upload directory exists and is accessible"""
    upload_dir = Path(settings.upload_dir).resolve()
    try:
        # Create directory if it doesn't exist
        upload_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Upload directory initialized at: {upload_dir.absolute()}")
        
        # Test write access
        test_file = upload_dir / ".test"
        test_file.write_text("test")
        test_file.unlink()
        logger.info("Upload directory is writable")
        
        # Log directory contents
        logger.info("Current directory contents:")
        for item in upload_dir.glob("**/*"):
            logger.info(f"  {item.relative_to(upload_dir)}")
        
    except Exception as e:
        logger.error(f"Failed to initialize upload directory: {str(e)}")
        raise RuntimeError(f"Upload directory initialization failed: {str(e)}")

# Initialize on module load
ensure_upload_directory()

@router.post("/upload")
async def upload_presentation(
    request: Request,
    file: UploadFile,
    background_tasks: BackgroundTasks
) -> JSONResponse:
    """Upload and process a presentation file"""
    try:
        # Validate file
        if not file or not file.filename:
            raise HTTPException(status_code=400, detail="No file provided")
            
        # Get and validate file extension
        file_ext = '.' + file.filename.lower().split('.')[-1]
        if file_ext not in SUPPORTED_FILE_TYPES:
            supported_types = ', '.join(SUPPORTED_FILE_TYPES.values())
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type. Supported types are: {supported_types}"
            )
        
        # Generate unique ID and create directories
        doc_id = str(uuid.uuid4())
        upload_dir = Path(settings.upload_dir).resolve() / doc_id
        upload_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Created document directory at: {upload_dir.absolute()}")
        
        # Save file with original name first
        original_path = upload_dir / file.filename
        try:
            logger.info(f"Saving original file to: {original_path.absolute()}")
            content = await file.read()
            with open(original_path, "wb") as f:
                f.write(content)
            logger.info(f"Original file saved successfully. Size: {len(content)} bytes")
            
            # Also save with doc_id name for consistency
            doc_path = upload_dir / f"{doc_id}{file_ext}"
            shutil.copy2(original_path, doc_path)
            logger.info(f"File copied to: {doc_path.absolute()}")
            
            # Log directory contents after save
            logger.info("Directory contents after save:")
            for item in upload_dir.glob("**/*"):
                logger.info(f"  {item.relative_to(upload_dir)} ({item.stat().st_size} bytes)")
            
        except Exception as e:
            logger.error(f"Error saving file: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to save file")
            
        # For PowerPoint files, we'll return processing status first
        if SUPPORTED_FILE_TYPES[file_ext] == 'PowerPoint':
            # Ensure both files exist
            if not original_path.exists() or not doc_path.exists():
                logger.error(f"Files not found after save: {original_path}, {doc_path}")
                raise HTTPException(status_code=500, detail="Files not found after save")

            logger.info(f"PowerPoint files saved successfully at: {original_path} and {doc_path}")
            
            # Create status file for tracking
            status_file = upload_dir / "status.json"
            status_data = {
                "document_id": doc_id,
                "status": "ready",  # Set to ready immediately since we're not converting
                "filename": file.filename,
                "type": SUPPORTED_FILE_TYPES[file_ext],
                "original_path": str(original_path.absolute()),
                "doc_path": str(doc_path.absolute())
            }
            
            with open(status_file, "w") as f:
                json.dump(status_data, f)
            
            logger.info(f"Status file created at: {status_file}")
            
            # Return processing status
            return JSONResponse(content={
                "document_id": doc_id,
                "status": "ready",
                "check_status_url": f"/api/presentations/status/{doc_id}"
            })
            
        # For other file types, process as before
        status_file = upload_dir / "status.json"
        with open(status_file, "w") as f:
            json.dump({
                "document_id": doc_id,
                "status": "processing",
                "progress": 0,
                "filename": file.filename,
                "type": SUPPORTED_FILE_TYPES[file_ext]
            }, f)
            
        return JSONResponse(content={
            "document_id": doc_id,
            "status": "processing",
            "check_status_url": f"/api/presentations/status/{doc_id}"
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/static/{path:path}")
async def get_static_file(path: str):
    """Serve static files"""
    file_path = Path(settings.upload_dir) / path
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
        
    return FileResponse(file_path)

@router.get("/status/{doc_id}")
async def check_status(doc_id: str) -> JSONResponse:
    """Check the status of a document conversion"""
    try:
        # Check both possible status file locations
        status_file = Path(f"data/documents/{doc_id}/status.json")
        if not status_file.exists():
            status_file = Path(settings.upload_dir) / doc_id / "status.json"
        
        if not status_file.exists():
            return JSONResponse(content={"status": "not_found", "document_id": doc_id})
        
        with open(status_file, "r") as f:
            status_data = json.load(f)
            
        # For PowerPoint files, check if the file exists and is ready
        if status_data.get("type") == "PowerPoint":
            file_path = Path(status_data.get("file_path", ""))
            if file_path.exists():
                # Update status to ready if file exists
                status_data["status"] = "ready"
                with open(status_file, "w") as f:
                    json.dump(status_data, f)
            
        return JSONResponse(content=status_data)
        
    except Exception as e:
        logger.error(f"Error checking status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to check status: {str(e)}")

@router.get("/documents/{doc_id}/{filename}")
async def get_document_file(doc_id: str, filename: str):
    """Get a document file by ID and filename"""
    try:
        logger.debug(f"Attempting to retrieve document: {doc_id}/{filename}")
        
        # Get the upload directory
        upload_dir = Path(settings.upload_dir) / doc_id
        
        # Try different possible filenames
        possible_files = [
            upload_dir / filename,  # Try the requested filename
            upload_dir / f"{doc_id}.pptx",  # Try doc_id.pptx
            upload_dir / f"{doc_id}.ppt",   # Try doc_id.ppt
            upload_dir / "presentation.pptx", # Try presentation.pptx
            *list(upload_dir.glob("*.ppt*")) # Try any PowerPoint file
        ]
        
        file_path = None
        for possible_file in possible_files:
            if possible_file.exists():
                file_path = possible_file
                logger.debug(f"Found file at: {file_path}")
                break
                
        if not file_path:
            logger.error(f"No PowerPoint file found in {upload_dir}")
            raise HTTPException(status_code=404, detail="File not found")
            
        # Determine content type
        content_type = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        if str(file_path).endswith(".ppt"):
            content_type = "application/vnd.ms-powerpoint"
            
        # Return file with CORS headers
        headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Content-Disposition": f'inline; filename="{file_path.name}"',
            "Cache-Control": "no-cache"
        }
        
        logger.debug(f"Serving file with content type: {content_type}")
        return FileResponse(
            path=file_path,
            media_type=content_type,
            filename=file_path.name,
            headers=headers
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.options("/documents/{doc_id}/{filename}")
async def options_document_file(doc_id: str, filename: str):
    """Handle OPTIONS requests for document files"""
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Cache-Control": "no-cache"
    }
    return JSONResponse(content={}, headers=headers)

@router.get("/file/{doc_id}")
async def get_presentation_file(doc_id: str):
    """Get the original presentation file"""
    try:
        logger.debug(f"Attempting to retrieve PowerPoint file for doc_id: {doc_id}")
        
        # Look for the file in both possible locations
        upload_dir = Path(settings.upload_dir) / doc_id
        documents_dir = Path("data/documents") / doc_id
        
        # Check both directories for PowerPoint files
        ppt_files = list(upload_dir.glob("*.ppt*"))
        if not ppt_files:
            ppt_files = list(documents_dir.glob("*.ppt*"))
            
        if not ppt_files:
            logger.error(f"No PowerPoint file found in either {upload_dir} or {documents_dir}")
            raise HTTPException(status_code=404, detail="PowerPoint file not found")
            
        file_path = ppt_files[0]
        logger.debug(f"Found PowerPoint file at: {file_path}")
        
        # Determine content type based on extension
        content_type = "application/vnd.openxmlformats-officedocument.presentationml.presentation" \
            if file_path.suffix == ".pptx" else "application/vnd.ms-powerpoint"
            
        # Return file as response with proper content type and CORS headers
        headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Content-Disposition": f'inline; filename="{file_path.name}"',
            "Cache-Control": "no-cache"
        }
        
        logger.debug(f"Serving file with content type: {content_type}")
        return FileResponse(
            path=file_path,
            media_type=content_type,
            filename=file_path.name,
            headers=headers
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving PowerPoint file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve PowerPoint file: {str(e)}")

@router.options("/file/{doc_id}")
async def options_presentation_file(doc_id: str):
    """Handle OPTIONS request for CORS"""
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Max-Age": "86400",  # 24 hours
    }
    return JSONResponse(content={}, headers=headers) 