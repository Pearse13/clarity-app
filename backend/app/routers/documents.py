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
from typing import Optional, cast
import httpx
import subprocess

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)  # Ensure debug logging is enabled

# Initialize router
router = APIRouter(prefix="/api/documents", tags=["documents"])

# Initialize presentation service (reusing for document handling)
presentation_service = PresentationService()

SUPPORTED_FILE_TYPES = {
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
        
        # Test write access
        test_file = upload_dir / "test_write_access.txt"
        test_file.write_text("Test write access")
        test_file.unlink()  # Delete test file
        
        return True
    except Exception as e:
        logger.error(f"Failed to validate upload directory: {str(e)}")
        return False

@router.post("/upload")
async def upload_document(file: UploadFile, request: Request):
    """
    Upload a Word document or PDF file
    
    - For Word documents (.doc, .docx): Convert to PDF using LibreOffice
    - For PDFs: Return as-is
    """
    logger.info(f"Starting document upload: {file.filename}")
    
    # Validate file name and extension
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file name provided")
    
    # Generate a unique ID for the document
    doc_id = str(uuid.uuid4())
    
    # Prepare upload directory
    upload_dir = Path(settings.upload_dir) / doc_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # Extract file extension
    file_ext = Path(file.filename).suffix.lower()
    
    # Check if file type is supported
    if file_ext not in SUPPORTED_FILE_TYPES:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type: {file_ext}. Supported types: {', '.join(SUPPORTED_FILE_TYPES.keys())}"
        )
    
    # Save the file
    doc_path = upload_dir / f"{doc_id}{file_ext}"
    
    try:
        with open(doc_path, "wb") as f:
            while content := await file.read(CHUNK_SIZE):
                f.write(content)
        
        # For Word files, convert to PDF
        if SUPPORTED_FILE_TYPES[file_ext] in ['Word']:
            if not doc_path.exists():
                logger.error(f"File not found after save: {doc_path}")
                raise HTTPException(status_code=500, detail="File not found after save")

            logger.info(f"Word document saved successfully at: {doc_path}")
            
            # Create status file
            status_file = upload_dir / "status.json"
            status_data = {
                "document_id": doc_id,
                "status": "processing",
                "filename": file.filename,
                "type": "Word",
                "file_path": str(doc_path)
            }
            
            with open(status_file, "w") as f:
                json.dump(status_data, f)
                
            # Convert Word to PDF using LibreOffice
            try:
                logger.info(f"Converting Word document to PDF using LibreOffice: {doc_path}")
                pdf_path = upload_dir / f"{doc_id}.pdf"
                
                # Convert using LibreOffice
                # Use absolute paths for reliability
                abs_doc_path = doc_path.absolute()
                abs_output_dir = upload_dir.absolute()
                
                cmd = [
                    "libreoffice", 
                    "--headless", 
                    "--convert-to", "pdf", 
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
                    
                logger.info(f"Word document successfully converted to PDF: {pdf_path}")
                
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
                    
                pdf_url = f"{base_url}/api/documents/file/{doc_id}/{doc_id}.pdf"
                doc_url = f"{base_url}/api/documents/file/{doc_id}/{doc_id}{file_ext}"
                
                return JSONResponse(content={
                    "document_id": doc_id,
                    "status": "ready",
                    "filename": file.filename,
                    "file_url": pdf_url,
                    "original_url": doc_url,
                    "type": "PDF"
                })
                
            except Exception as e:
                logger.error(f"Word to PDF conversion failed: {str(e)}")
                status_data["status"] = "error"
                status_data["error"] = str(e)
                with open(status_file, "w") as f:
                    json.dump(status_data, f)
                    
                # Return Word URL as fallback
                base_url = str(request.base_url).rstrip('/')
                # Ensure we use HTTPS for the URL
                if base_url.startswith('http://'):
                    base_url = base_url.replace('http://', 'https://')
                    
                doc_url = f"{base_url}/api/documents/file/{doc_id}/{doc_id}{file_ext}"
                
                return JSONResponse(content={
                    "document_id": doc_id,
                    "status": "error",
                    "filename": file.filename,
                    "file_url": doc_url,
                    "original_url": doc_url,
                    "error": f"PDF conversion failed: {str(e)}",
                    "type": "Word"
                })
            
        # For PDF files, return immediately - NO CHANGES to this section to preserve original behavior
        if SUPPORTED_FILE_TYPES[file_ext] == 'PDF':
            if not doc_path.exists():
                logger.error(f"File not found after save: {doc_path}")
                raise HTTPException(status_code=500, detail="File not found after save")

            logger.info(f"PDF file saved successfully at: {doc_path}")
            
            # Create status file for PDF
            status_file = upload_dir / "status.json"
            status_data = {
                "document_id": doc_id,
                "status": "ready",
                "filename": file.filename,
                "type": "PDF",
                "file_path": str(doc_path)
            }
            
            with open(status_file, "w") as f:
                json.dump(status_data, f)
                
            # Return PDF URL for viewing
            base_url = str(request.base_url).rstrip('/')
            # Ensure we use HTTPS for the URL
            if base_url.startswith('http://'):
                base_url = base_url.replace('http://', 'https://')
                
            pdf_url = f"{base_url}/api/documents/file/{doc_id}/{doc_id}{file_ext}"
            
            return JSONResponse(content={
                "document_id": doc_id,
                "status": "ready",
                "filename": file.filename,
                "file_url": pdf_url,
                "original_url": pdf_url
            })
            
    except Exception as e:
        logger.error(f"Error saving document: {str(e)}")
        logger.error(f"Stack trace: {''.join(traceback.format_exception(*sys.exc_info()))}")
        raise HTTPException(status_code=500, detail=f"Error processing document: {str(e)}")

@router.get("/file/{document_id}/{filename}")
async def get_document_file(document_id: str, filename: str, request: Request):
    """
    Serve a document file directly
    """
    logger.info(f"Request to access document file: {document_id}/{filename}")
    
    # Validate path
    upload_dir = Path(settings.upload_dir) / document_id
    file_path = upload_dir / filename
    
    if not file_path.exists():
        logger.error(f"Document file not found: {file_path}")
        raise HTTPException(status_code=404, detail="Document file not found")
    
    # Serve the file
    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type="application/octet-stream" 
    )

@router.get("/status/{document_id}")
async def get_document_status(document_id: str):
    """
    Get the status of a document
    """
    logger.info(f"Checking status for document: {document_id}")
    
    # Check status file
    upload_dir = Path(settings.upload_dir) / document_id
    status_file = upload_dir / "status.json"
    
    if not status_file.exists():
        logger.error(f"Status file not found for document: {document_id}")
        raise HTTPException(status_code=404, detail="Document not found")
    
    try:
        with open(status_file, "r") as f:
            status_data = json.load(f)
        
        return JSONResponse(content=status_data)
    except Exception as e:
        logger.error(f"Error reading status file: {str(e)}")
        raise HTTPException(status_code=500, detail="Error reading document status") 