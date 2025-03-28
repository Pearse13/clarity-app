from fastapi import APIRouter, UploadFile, HTTPException, Request, BackgroundTasks
from ..services.presentation_service import PresentationService
import logging
import shutil
from pathlib import Path
import tempfile
import asyncio
from fastapi.responses import JSONResponse, FileResponse, Response, StreamingResponse
import sys
import traceback
import uuid
import json
import os
from ..core.config import settings
import cloudconvert
from typing import Optional, cast
import httpx
import subprocess

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)  # Ensure debug logging is enabled

# Initialize router
router = APIRouter(prefix="/api/presentations", tags=["presentations"])

# Initialize presentation service
presentation_service = PresentationService()

# Initialize CloudConvert
def init_cloudconvert() -> Optional[str]:
    """Initialize CloudConvert with API key from settings."""
    try:
        # Access the API key directly from settings
        api_key: Optional[str] = settings.cloudconvert_api_key
        if not api_key:
            logger.warning("CloudConvert API key not found in settings")
            return None
            
        logger.debug(f"Configuring CloudConvert with API key (length: {len(api_key)})")
        cloudconvert.configure(api_key=api_key)
        logger.debug("CloudConvert configured successfully")
        return api_key
    except Exception as e:
        logger.error(f"Failed to configure CloudConvert: {str(e)}")
        logger.error(f"Stack trace: {''.join(traceback.format_exception(*sys.exc_info()))}")
        return None

# Initialize CloudConvert on module load
cloudconvert_api_key = init_cloudconvert()

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
        
        # Ensure the upload directory exists and is accessible
        upload_base_dir = Path(settings.upload_dir).resolve()
        upload_dir = upload_base_dir / doc_id
        
        try:
            upload_dir.mkdir(parents=True, exist_ok=True)
            logger.info(f"Created document directory at: {upload_dir.absolute()}")
            
            # Log directory paths for debugging
            logger.info(f"Upload base directory: {upload_base_dir}")
            logger.info(f"Document upload directory: {upload_dir}")
            logger.info(f"Settings upload_dir: {settings.upload_dir}")
        except Exception as e:
            logger.error(f"Failed to create upload directory: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to create upload directory")
        
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
            
        # For PowerPoint or Word files, convert to PDF
        if SUPPORTED_FILE_TYPES[file_ext] in ['PowerPoint', 'Word']:
            if not doc_path.exists():
                logger.error(f"File not found after save: {doc_path}")
                raise HTTPException(status_code=500, detail="File not found after save")

            logger.info(f"{SUPPORTED_FILE_TYPES[file_ext]} file saved successfully at: {doc_path}")
            
            # Create status file
            status_file = upload_dir / "status.json"
            status_data = {
                "document_id": doc_id,
                "status": "processing",
                "filename": file.filename,
                "type": SUPPORTED_FILE_TYPES[file_ext],
                "file_path": str(doc_path)
            }
            
            with open(status_file, "w") as f:
                json.dump(status_data, f)
                
            # Convert file to PDF using LibreOffice
            try:
                logger.info(f"Converting {SUPPORTED_FILE_TYPES[file_ext]} to PDF using LibreOffice: {doc_path}")
                pdf_path = upload_dir / f"{doc_id}.pdf"
                
                # Convert using LibreOffice
                # Use absolute paths for reliability
                abs_doc_path = doc_path.absolute()
                abs_output_dir = upload_dir.absolute()
                
                cmd = [
                    "libreoffice", 
                    "--headless", 
                    "--norestore",
                    "--nofirststartwizard",
                    "--infilter=impress8",  # Force PowerPoint filter
                    "--convert-to", 
                    "pdf:writer_pdf_Export:SelectPdfVersion=1",  # PDF/A-1a format for better text preservation
                    "--outdir", str(abs_output_dir),
                    str(abs_doc_path)
                ]
                
                logger.info(f"Running conversion command: {' '.join(cmd)}")
                process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE
                )
                stdout, stderr = process.communicate()
                logger.info(f"Conversion output: {stdout.decode() if stdout else ''}")
                
                # Check if the conversion was successful
                if process.returncode != 0:
                    logger.error(f"Conversion error: {stderr.decode() if stderr else 'Unknown error'}")
                    raise Exception(f"LibreOffice conversion failed: {stderr.decode() if stderr else 'Unknown error'}")
                
                # Check if the PDF was created
                if not pdf_path.exists():
                    logger.error(f"PDF not created after conversion: {pdf_path}")
                    raise Exception("PDF not created after conversion")
                    
                logger.info(f"{SUPPORTED_FILE_TYPES[file_ext]} successfully converted to PDF: {pdf_path}")
                
                # Update the status file
                status_data["status"] = "ready"
                status_data["pdf_path"] = str(pdf_path)
                with open(status_file, "w") as f:
                    json.dump(status_data, f)
                
                # Return PDF URL for viewing
                base_url = str(request.base_url).rstrip('/')
                # Ensure we use HTTPS for the URL
                if base_url.startswith('http://'):
                    base_url = base_url.replace('http://', 'https://')
                    
                pdf_url = f"{base_url}/api/presentations/documents/{doc_id}/{doc_id}.pdf"
                original_url = f"{base_url}/api/presentations/documents/{doc_id}/{doc_id}{file_ext}"
                
                return JSONResponse(content={
                    "document_id": doc_id,
                    "status": "ready",
                    "filename": file.filename,
                    "file_url": pdf_url,
                    "original_url": original_url,
                    "type": "PDF"
                })
                
            except Exception as e:
                logger.error(f"{SUPPORTED_FILE_TYPES[file_ext]} to PDF conversion failed: {str(e)}")
                status_data["status"] = "error"
                status_data["error"] = str(e)
                with open(status_file, "w") as f:
                    json.dump(status_data, f)
                    
                # Return original URL as fallback
                base_url = str(request.base_url).rstrip('/')
                # Ensure we use HTTPS for the URL
                if base_url.startswith('http://'):
                    base_url = base_url.replace('http://', 'https://')
                file_url = f"{base_url}/api/presentations/documents/{doc_id}/{doc_id}{file_ext}"
                
                return JSONResponse(content={
                    "document_id": doc_id,
                    "status": "error",
                    "filename": file.filename,
                    "file_url": file_url,
                    "error": str(e),
                    "type": SUPPORTED_FILE_TYPES[file_ext]
                })
                
        elif SUPPORTED_FILE_TYPES[file_ext] == 'PDF':
            # For PDF files, we just return the file_url without conversion
            base_url = str(request.base_url).rstrip('/')
            # Ensure we use HTTPS for the URL
            if base_url.startswith('http://'):
                base_url = base_url.replace('http://', 'https://')
            file_url = f"{base_url}/api/presentations/documents/{doc_id}/{doc_id}{file_ext}"
            
            return JSONResponse(content={
                "document_id": doc_id,
                "status": "ready",
                "filename": file.filename,
                "file_url": file_url,
                "type": "PDF"
            })
            
        # Return the URL for this file
        base_url = str(request.base_url).rstrip('/')
        # Ensure we use HTTPS for the URL
        if base_url.startswith('http://'):
            base_url = base_url.replace('http://', 'https://')
        file_url = f"{base_url}/api/presentations/documents/{doc_id}/{doc_id}{file_ext}"
            
        return JSONResponse(content={
            "document_id": doc_id,
            "status": "ready",
            "filename": file.filename,
            "file_url": file_url,
            "type": SUPPORTED_FILE_TYPES[file_ext]
        })
        
    except Exception as e:
        # Log the full stack trace for debugging
        logger.error(f"Error processing upload: {str(e)}")
        logger.error(f"Stack trace: {''.join(traceback.format_exception(*sys.exc_info()))}")
        
        # Return error response
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(e)}
        )

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
        elif file_path.suffix.lower() in ['.docx']:
            content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        elif file_path.suffix.lower() in ['.doc']:
            content_type = "application/msword"
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
        elif file_path.suffix.lower() in ['.docx']:
            content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        elif file_path.suffix.lower() in ['.doc']:
            content_type = "application/msword"
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

@router.get("/test-cloudconvert")
async def test_cloudconvert():
    """Test CloudConvert API connection"""
    try:
        # Check if API key is set
        if not cloudconvert_api_key:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "detail": "CloudConvert API key not configured"}
            )
        
        # Try to create a simple job to test the API connection
        logger.info("Testing CloudConvert API connection")
        try:
            # Create a simple test job
            test_job = cloudconvert.Job.create(payload={
                "tasks": {
                    'ping-task': {
                        'operation': 'ping'
                    }
                }
            })
            
            logger.info(f"CloudConvert test job created: {test_job}")
            return JSONResponse(
                content={
                    "status": "success", 
                    "message": "CloudConvert connection successful",
                    "job": test_job
                }
            )
        except Exception as e:
            logger.error(f"CloudConvert API test failed: {str(e)}")
            logger.error(f"Exception details: {traceback.format_exc()}")
            return JSONResponse(
                status_code=500,
                content={"status": "error", "detail": f"CloudConvert API error: {str(e)}"}
            )
    except Exception as e:
        logger.error(f"Unexpected error testing CloudConvert: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "detail": f"Unexpected error: {str(e)}"}
        )

@router.get("/proxy/pdf/{doc_id}/{filename}")
async def proxy_pdf_file(doc_id: str, filename: str, request: Request):
    """Proxy PDF files to avoid CORS/CSP issues"""
    try:
        logger.debug(f"Proxying PDF file: {doc_id}/{filename}")
        
        # Get the upload directory
        upload_dir = Path(settings.upload_dir) / doc_id
        logger.debug(f"Looking for PDF file in: {upload_dir}")
        
        # Find the PDF file
        pdf_path = upload_dir / filename
        if not pdf_path.exists():
            logger.error(f"PDF file not found: {pdf_path}")
            raise HTTPException(status_code=404, detail="PDF file not found")
        
        # Return the file directly
        logger.info(f"Serving PDF file through proxy: {pdf_path}")
        return FileResponse(
            path=pdf_path,
            media_type="application/pdf",
            filename=filename,
            headers={
                "Content-Disposition": f"inline; filename={filename}",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "*",
                "Cache-Control": "public, max-age=3600"
            }
        )
    except Exception as e:
        logger.error(f"Error proxying PDF file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to proxy PDF file: {str(e)}")

@router.options("/proxy/pdf/{doc_id}/{filename}")
async def options_proxy_pdf(doc_id: str, filename: str):
    """Handle OPTIONS requests for proxied PDF files"""
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Cache-Control": "no-cache"
    }
    return JSONResponse(content={}, headers=headers)

@router.get("/proxy/ppt/{doc_id}/{filename}")
async def proxy_ppt_file(doc_id: str, filename: str, request: Request):
    """Proxy PowerPoint files to avoid CORS/CSP issues and ensure proper content type"""
    try:
        logger.debug(f"Proxying PowerPoint file: {doc_id}/{filename}")
        
        # Get the upload directory
        upload_dir = Path(settings.upload_dir) / doc_id
        logger.debug(f"Looking for PowerPoint file in: {upload_dir}")
        
        # Find the PowerPoint file
        ppt_path = upload_dir / filename
        if not ppt_path.exists():
            logger.error(f"PowerPoint file not found: {ppt_path}")
            raise HTTPException(status_code=404, detail="PowerPoint file not found")
        
        # Determine the content type based on file extension
        content_type = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        if filename.lower().endswith('.ppt'):
            content_type = "application/vnd.ms-powerpoint"
        
        # Return the file directly with proper headers
        logger.info(f"Serving PowerPoint file through proxy: {ppt_path}")
        return FileResponse(
            path=ppt_path,
            media_type=content_type,
            filename=filename,
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "*",
                "Cache-Control": "public, max-age=3600"
            }
        )
    except Exception as e:
        logger.error(f"Error proxying PowerPoint file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to proxy PowerPoint file: {str(e)}") 