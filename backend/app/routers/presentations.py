from fastapi import APIRouter, UploadFile, HTTPException, Request, BackgroundTasks
from ..services.presentation_service import PresentationService
import logging
import shutil
from pathlib import Path
import tempfile
import asyncio
from fastapi.responses import JSONResponse, FileResponse, Response
import sys
import traceback
import uuid
import json
import os
from ..core.config import settings
import cloudconvert

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)  # Ensure debug logging is enabled

# Initialize router
router = APIRouter(prefix="/api/presentations", tags=["presentations"])

# Initialize presentation service
presentation_service = PresentationService()

# Initialize CloudConvert
try:
    logger.debug(f"Configuring CloudConvert with API key present: {bool(settings.cloudconvert_api_key)}")
    logger.debug(f"CloudConvert API key length: {len(settings.cloudconvert_api_key) if settings.cloudconvert_api_key else 0}")
    cloudconvert.configure(api_key=settings.cloudconvert_api_key)
    logger.debug("CloudConvert configured successfully")
except Exception as e:
    logger.error(f"Failed to configure CloudConvert: {str(e)}")
    logger.error(f"Stack trace: {''.join(traceback.format_exception(*sys.exc_info()))}")

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
        upload_dir = Path(settings.upload_dir) / doc_id
        upload_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Created document directory at: {upload_dir.absolute()}")
        
        # Save file with doc_id name only
        doc_path = upload_dir / f"{doc_id}{file_ext}"
        try:
            logger.info(f"Saving file to: {doc_path.absolute()}")
            content = await file.read()
            with open(doc_path, "wb") as f:
                f.write(content)
            logger.info(f"File saved successfully. Size: {len(content)} bytes")
            
            # Log directory contents after save
            logger.info("Directory contents after save:")
            for item in upload_dir.glob("**/*"):
                logger.info(f"  {item.relative_to(upload_dir)} ({item.stat().st_size} bytes)")
            
        except Exception as e:
            logger.error(f"Error saving file: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to save file")
            
        # For PowerPoint files, convert to PDF
        if SUPPORTED_FILE_TYPES[file_ext] == 'PowerPoint':
            # Save original file
            original_path = upload_dir / f"{doc_id}{file_ext}"
            content = await file.read()
            with open(original_path, "wb") as f:
                f.write(content)
                
            try:
                # Convert to PDF using CloudConvert
                logger.info("Starting PowerPoint to PDF conversion with CloudConvert")
                # Define pdf_path before using it
                pdf_path = upload_dir / f"{doc_id}.pdf"
                logger.debug(f"PDF will be saved to: {pdf_path}")
                
                job = cloudconvert.Job.create(payload={
                    "tasks": {
                        "import-file": {
                            "operation": "import/upload"
                        },
                        "convert-file": {
                            "operation": "convert",
                            "input": ["import-file"],
                            "output_format": "pdf",
                            "engine": "office"
                        },
                        "export-file": {
                            "operation": "export/url",
                            "input": ["convert-file"]
                        }
                    }
                })
                logger.info(f"CloudConvert job created with ID: {job['id']}")
                
                # Upload file for conversion
                logger.info("Uploading file to CloudConvert")
                upload_task = next(task for task in job["tasks"] if task["name"] == "import-file")
                logger.debug(f"Upload task ID: {upload_task['id']}")
                cloudconvert.Task.upload(file_name=str(original_path), task=upload_task)
                logger.info("File uploaded successfully")
                
                # Wait for conversion
                logger.info("Waiting for conversion to complete")
                job = cloudconvert.Job.wait(id=job["id"])
                logger.info("Conversion completed")
                
                export_task = next(task for task in job["tasks"] if task["operation"] == "export/url")
                logger.debug(f"Export task ID: {export_task['id']}")
                
                # Download converted PDF
                logger.info(f"Downloading converted PDF to: {pdf_path}")
                cloudconvert.download(url=export_task["result"]["files"][0]["url"], filename=pdf_path)
                logger.info("PDF downloaded successfully")
                
                # Create status file
                status_file = upload_dir / "status.json"
                status_data = {
                    "document_id": doc_id,
                    "status": "ready",
                    "filename": file.filename,
                    "type": "PDF",  # Treat as PDF after conversion
                    "original_type": "PowerPoint",
                    "file_path": str(pdf_path)
                }
                
                with open(status_file, "w") as f:
                    json.dump(status_data, f)
                
                # Return PDF URL for viewing
                base_url = str(request.base_url).rstrip('/')
                pdf_url = f"{base_url}/static/uploads/{doc_id}/{doc_id}.pdf"
                
                return JSONResponse(content={
                    "document_id": doc_id,
                    "status": "ready",
                    "filename": file.filename,
                    "file_url": pdf_url,
                    "original_url": f"{base_url}/static/uploads/{doc_id}/{doc_id}{file_ext}"
                })
                
            except Exception as e:
                logger.error(f"Conversion failed: {str(e)}")
                raise HTTPException(status_code=500, detail="Failed to convert PowerPoint to PDF")
            
        # For PDF files, return immediately
        if SUPPORTED_FILE_TYPES[file_ext] == 'PDF':
            if not doc_path.exists():
                logger.error(f"File not found after save: {doc_path}")
                raise HTTPException(status_code=500, detail="File not found after save")

            logger.info(f"PDF file saved successfully at: {doc_path}")
            
            return JSONResponse(content={
                "document_id": doc_id,
                "status": "ready",
                "filename": file.filename
            })
            
        # Return for unsupported file types
        return JSONResponse(content={
            "document_id": doc_id,
            "status": "error",
            "detail": f"Unsupported file type: {file_ext}"
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
        
        # Get the upload directory using absolute path
        upload_dir = Path(settings.upload_dir) / doc_id
        logger.debug(f"Looking for file in: {upload_dir}")
        
        # Try to find the exact file first
        file_path = upload_dir / filename
        if not file_path.exists():
            # If exact file not found, try to find any file with matching extension
            logger.debug(f"Exact file not found, searching for files with matching extension")
            matching_files = list(upload_dir.glob(f"*.{filename.split('.')[-1]}"))
            if matching_files:
                file_path = matching_files[0]
                logger.debug(f"Found matching file: {file_path}")
            else:
                logger.error(f"No matching files found in {upload_dir}")
                raise HTTPException(status_code=404, detail="File not found")
                
        logger.debug(f"Found file at: {file_path}")
        
        # Verify file exists and is readable
        try:
            with open(file_path, 'rb') as f:
                f.read(1)  # Try to read 1 byte to verify file is accessible
            logger.debug("File is readable")
        except Exception as e:
            logger.error(f"File exists but is not readable: {e}")
            raise HTTPException(status_code=500, detail="File is not accessible")
                
        # Determine content type
        content_type = None
        if file_path.suffix.lower() in ['.pptx']:
            content_type = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        elif file_path.suffix.lower() in ['.ppt']:
            content_type = "application/vnd.ms-powerpoint"
        elif file_path.suffix.lower() in ['.pdf']:
            content_type = "application/pdf"
            
        if not content_type:
            content_type = "application/octet-stream"
            
        logger.debug(f"Determined content type: {content_type}")
            
        # Return file with headers optimized for Office Online Viewer
        headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Expose-Headers": "Content-Length, Content-Range",
            "Content-Type": content_type,
            "Content-Disposition": "attachment; filename=" + file_path.name,
            "Cache-Control": "public, max-age=3600",
            "X-Content-Type-Options": "nosniff",
            "Accept-Ranges": "bytes"
        }
        
        logger.debug(f"Serving file with headers: {headers}")
        return FileResponse(
            path=file_path,
            media_type=content_type,
            headers=headers,
            filename=file_path.name
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving file: {str(e)}")
        logger.error(f"Stack trace: {''.join(traceback.format_exception(*sys.exc_info()))}")
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

@router.head("/documents/{doc_id}/{filename}")
async def head_document_file(doc_id: str, filename: str):
    """Handle HEAD requests for document files"""
    try:
        logger.debug(f"HEAD request for document: {doc_id}/{filename}")
        
        # Get the upload directory using absolute path
        upload_dir = Path(settings.upload_dir) / doc_id
        logger.debug(f"Looking for file in: {upload_dir}")
        
        # Try to find the exact file first
        file_path = upload_dir / filename
        if not file_path.exists():
            # If exact file not found, try to find any file with matching extension
            matching_files = list(upload_dir.glob(f"*.{filename.split('.')[-1]}"))
            if matching_files:
                file_path = matching_files[0]
                logger.debug(f"Found matching file: {file_path}")
            else:
                logger.error(f"No matching files found in {upload_dir}")
                raise HTTPException(status_code=404, detail="File not found")
                
        # Determine content type
        content_type = None
        if file_path.suffix.lower() in ['.pptx']:
            content_type = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        elif file_path.suffix.lower() in ['.ppt']:
            content_type = "application/vnd.ms-powerpoint"
        elif file_path.suffix.lower() in ['.pdf']:
            content_type = "application/pdf"
            
        if not content_type:
            content_type = "application/octet-stream"
            
        # Return headers only for HEAD request
        headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Content-Type": content_type,
            "Content-Length": str(file_path.stat().st_size),
            "Content-Disposition": "attachment",
            "Cache-Control": "public, max-age=3600",
            "X-Content-Type-Options": "nosniff",
            "Accept-Ranges": "bytes"
        }
        
        return Response(headers=headers)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error handling HEAD request: {str(e)}")
        logger.error(f"Stack trace: {''.join(traceback.format_exception(*sys.exc_info()))}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/file/{doc_id}")
async def get_presentation_file(doc_id: str):
    """Get the original presentation file"""
    try:
        logger.debug(f"Attempting to retrieve PowerPoint file for doc_id: {doc_id}")
        
        # Use the absolute path where files are actually stored
        upload_dir = Path("/app/app/data/uploads") / doc_id
        logger.debug(f"Looking for PowerPoint files in: {upload_dir}")
        
        # Check for PowerPoint files
        ppt_files = list(upload_dir.glob("*.ppt*"))
            
        if not ppt_files:
            logger.error(f"No PowerPoint file found in {upload_dir}")
            raise HTTPException(status_code=404, detail="PowerPoint file not found")
            
        file_path = ppt_files[0]
        logger.debug(f"Found PowerPoint file at: {file_path}")
        
        # Verify file exists and is readable
        try:
            with open(file_path, 'rb') as f:
                f.read(1)  # Try to read 1 byte to verify file is accessible
            logger.debug("File is readable")
        except Exception as e:
            logger.error(f"File exists but is not readable: {e}")
            raise HTTPException(status_code=500, detail="File is not accessible")
        
        # Determine content type based on extension
        content_type = "application/vnd.openxmlformats-officedocument.presentationml.presentation" \
            if file_path.suffix == ".pptx" else "application/vnd.ms-powerpoint"
            
        # Return file with proper headers
        headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Content-Disposition": f'inline; filename="{file_path.name}"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
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
        logger.error(f"Stack trace: {''.join(traceback.format_exception(*sys.exc_info()))}")
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