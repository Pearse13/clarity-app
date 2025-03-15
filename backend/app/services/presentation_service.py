from pathlib import Path
import subprocess
import uuid
import shutil
import os
import asyncio
from typing import Optional, Dict, Any
from fastapi import UploadFile, HTTPException
import logging
from threading import Thread
import time
import re
import sys
import psutil
import atexit
from datetime import datetime, timedelta
import json
import traceback

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

class ProcessMonitor:
    def __init__(self):
        self.last_cleanup = datetime.now()
        self.cleanup_interval = timedelta(minutes=5)
        self._start_monitor()
        atexit.register(self.cleanup_processes)

    def _start_monitor(self):
        """Start the background monitor thread"""
        def monitor():
            while True:
                try:
                    if datetime.now() - self.last_cleanup >= self.cleanup_interval:
                        self.cleanup_processes()
                        self.last_cleanup = datetime.now()
                except Exception as e:
                    logger.error(f"Error in process monitor: {e}")
                time.sleep(60)  # Check every minute
        
        Thread(target=monitor, daemon=True).start()

    def cleanup_processes(self):
        """Clean up any stray LibreOffice processes"""
        try:
            # Find all soffice processes
            for proc in psutil.process_iter(['pid', 'name', 'create_time']):
                try:
                    proc_info = proc.as_dict(['name', 'create_time'])
                    if proc_info.get('name', '').lower().startswith('soffice'):
                        # Kill processes older than 10 minutes
                        if time.time() - proc_info.get('create_time', 0) > 600:
                            logger.info(f"Killing stale LibreOffice process: {proc_info}")
                            proc.kill()
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
        except Exception as e:
            logger.error(f"Error cleaning up processes: {e}")

# Global process monitor
process_monitor = ProcessMonitor()

def sanitize_filename(filename: str) -> str:
    """Sanitize filename to remove special characters and spaces"""
    # Fix double extension issue
    if filename.endswith('.pptx.pptx'):
        filename = filename[:-5]  # Remove one .pptx
    
    # Keep the file extension
    name, ext = os.path.splitext(filename)
    # Replace spaces and special characters with underscores
    name = re.sub(r'[^a-zA-Z0-9]', '_', name)
    # Remove multiple consecutive underscores
    name = re.sub(r'_+', '_', name)
    # Remove leading/trailing underscores
    name = name.strip('_')
    return f"{name}{ext}"

def send_enter_key(process):
    """Send continuous Enter key presses to a process"""
    try:
        while process.poll() is None:  # While process is running
            try:
                if process.stdin:
                    process.stdin.write(b'\n')
                    process.stdin.flush()
            except (OSError, IOError) as e:
                break  # Stop if pipe is broken
            time.sleep(0.1)  # Small delay between keypresses
    except Exception as e:
        logger.error(f"Error in send_enter thread: {e}")

class PresentationService:
    def __init__(self):
        # Use relative paths for Railway compatibility
        self.data_dir = Path("data")
        self.temp_dir = self.data_dir / "temp"
        self.documents_dir = self.data_dir / "documents"
        
        # Ensure directories exist
        for directory in [self.data_dir, self.temp_dir, self.documents_dir]:
            directory.mkdir(parents=True, exist_ok=True)
            
        # Log directory paths for debugging
        logger.info(f"Data directory: {self.data_dir.absolute()}")
        logger.info(f"Temp directory: {self.temp_dir.absolute()}")
        logger.info(f"Documents directory: {self.documents_dir.absolute()}")
        
        # Set LibreOffice path based on operating system
        if os.name == 'nt':  # Windows
            self.soffice_path = Path(r"C:\Program Files\LibreOffice\program\soffice.exe")
            if not self.soffice_path.exists():
                # Try alternate path
                self.soffice_path = Path(r"C:\Program Files (x86)\LibreOffice\program\soffice.exe")
        else:  # Linux/Unix
            # Check common Linux paths
            possible_paths = [
                Path("/usr/bin/libreoffice"),
                Path("/usr/bin/soffice"),
                Path("/usr/lib/libreoffice/program/soffice"),
                Path("/opt/libreoffice/program/soffice")
            ]
            
            for path in possible_paths:
                if path.exists():
                    self.soffice_path = path
                    break
            else:
                # If no path is found, default to the most common location
                self.soffice_path = Path("/usr/bin/soffice")
        
        logger.info(f"Using LibreOffice at: {self.soffice_path}")

    async def _ensure_libreoffice_ready(self):
        """Ensure LibreOffice is in a good state before conversion"""
        try:
            logger.info("Ensuring LibreOffice is ready...")
            
            # Force cleanup of any existing processes
            logger.info("Cleaning up any existing LibreOffice processes...")
            process_monitor.cleanup_processes()
            
            # Just verify the executable exists
            soffice_path = Path(self.soffice_path)
            if not soffice_path.exists():
                raise Exception(f"LibreOffice not found at: {self.soffice_path}")
            
            if not os.access(str(soffice_path), os.X_OK):
                raise Exception(f"LibreOffice at {self.soffice_path} is not executable")
            
            logger.info("LibreOffice readiness check successful")
            
        except Exception as e:
            logger.error(f"Error ensuring LibreOffice ready: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to prepare LibreOffice for conversion: {str(e)}"
            )

    async def process_presentation(self, input_path: str, output_dir: str, doc_id: str) -> Dict[str, Any]:
        """Process a presentation file and convert it to HTML"""
        try:
            input_path_obj = Path(input_path)
            output_dir_obj = Path(output_dir)
            
            # Ensure output directory exists
            output_dir_obj.mkdir(parents=True, exist_ok=True)
            
            # Update status to processing
            self._update_status(output_dir_obj, {
                "document_id": doc_id,
                "status": "processing",
                "progress": 10,
                "message": "Starting conversion process"
            })
            
            # Get file extension
            file_ext = input_path_obj.suffix.lower()
            
            # Determine file type and conversion method
            if file_ext in ['.ppt', '.pptx']:
                result = await self._convert_powerpoint(input_path_obj, output_dir_obj, doc_id)
            elif file_ext in ['.doc', '.docx']:
                # Placeholder for Word conversion
                result = {
                    "document_id": doc_id,
                    "status": "error",
                    "error": "Word document conversion not yet implemented"
                }
            elif file_ext == '.pdf':
                # Placeholder for PDF processing
                result = {
                    "document_id": doc_id,
                    "status": "error",
                    "error": "PDF processing not yet implemented"
                }
            else:
                raise ValueError(f"Unsupported file type: {file_ext}")
            
            # Clean up temp file
            if input_path_obj.exists():
                try:
                    input_path_obj.unlink()
                    logger.info(f"Deleted temp file: {input_path_obj}")
                except Exception as e:
                    logger.error(f"Failed to delete temp file: {str(e)}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error processing presentation: {str(e)}")
            logger.error(f"Stack trace: {''.join(traceback.format_exception(*sys.exc_info()))}")
            
            # Update status to error
            try:
                output_dir_obj = Path(output_dir)
                self._update_status(output_dir_obj, {
                    "document_id": doc_id,
                    "status": "error",
                    "error": str(e),
                    "message": "Conversion failed"
                })
            except Exception as status_error:
                logger.error(f"Failed to update error status: {str(status_error)}")
            
            return {
                "document_id": doc_id,
                "status": "error",
                "error": str(e)
            }
    
    def _update_status(self, output_dir: Path, status_data: Dict[str, Any]) -> None:
        """Update the status file with the latest status"""
        try:
            status_file = output_dir / "status.json"
            with open(status_file, "w") as f:
                json.dump(status_data, f)
            logger.debug(f"Updated status: {status_data}")
        except Exception as e:
            logger.error(f"Failed to update status: {str(e)}")
    
    async def _convert_powerpoint(self, input_path: Path, output_dir: Path, doc_id: str) -> Dict[str, Any]:
        """Convert PowerPoint to HTML using LibreOffice"""
        try:
            # Update status
            self._update_status(output_dir, {
                "document_id": doc_id,
                "status": "processing",
                "progress": 30,
                "message": "Converting PowerPoint to HTML"
            })
            
            # Create HTML output path
            html_output = output_dir / "index.html"
            
            # Log paths for debugging
            logger.debug(f"Input path: {input_path.absolute()}")
            logger.debug(f"Output directory: {output_dir.absolute()}")
            logger.debug(f"HTML output path: {html_output.absolute()}")
            
            # Check if input file exists
            if not input_path.exists():
                raise FileNotFoundError(f"Input file not found: {input_path}")
            
            # Check if input file is empty
            if input_path.stat().st_size == 0:
                raise ValueError(f"Input file is empty: {input_path}")
            
            # Convert to HTML using LibreOffice
            cmd = [
                "soffice",
                "--headless",
                "--convert-to",
                "html",
                "--outdir",
                str(output_dir),
                str(input_path)
            ]
            
            logger.info(f"Running command: {' '.join(cmd)}")
            
            # Execute the command
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                stdin=subprocess.PIPE
            )
            
            # Start a thread to send Enter key presses to handle any dialogs
            Thread(target=send_enter_key, args=(process,), daemon=True).start()
            
            # Wait for process to complete with timeout
            try:
                stdout, stderr = process.communicate(timeout=120)
                logger.debug(f"Command output: {stdout.decode() if stdout else ''}")
                logger.debug(f"Command error: {stderr.decode() if stderr else ''}")
            except subprocess.TimeoutExpired:
                process.kill()
                logger.error("Command timed out after 120 seconds")
                raise TimeoutError("Conversion process timed out")
            
            # Check if process was successful
            if process.returncode != 0:
                logger.error(f"Command failed with return code {process.returncode}")
                raise RuntimeError(f"Conversion failed: {stderr.decode() if stderr else 'Unknown error'}")
            
            # Check if output file exists
            output_files = list(output_dir.glob("*.html"))
            if not output_files:
                raise FileNotFoundError("No HTML files were generated")
            
            # Rename the output file to index.html if needed
            if output_files[0].name != "index.html":
                output_files[0].rename(html_output)
            
            # Update status to completed
            result = {
                "document_id": doc_id,
                "status": "completed",
                "progress": 100,
                "url": f"/documents/{doc_id}/index.html",
                "message": "Conversion completed successfully"
            }
            
            self._update_status(output_dir, result)
            return result
            
        except Exception as e:
            logger.error(f"Error converting PowerPoint: {str(e)}")
            raise

    def _clean_html_content(self, content: str | Path) -> str:
        """Clean up the HTML content to make it iframe-friendly"""
        try:
            # Handle both string and Path inputs
            if isinstance(content, Path):
                with open(content, 'r', encoding='utf-8') as f:
                    html_content = f.read()
            else:
                html_content = content
            
            # Add base target to prevent links from breaking out of iframe
            if '<head>' not in html_content:
                html_content = '<head></head>' + html_content
            
            # Add viewport meta tag and security headers for local development
            head_content = """
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' http://localhost:* data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; frame-ancestors *">
                <base target="_blank">
            """
            html_content = html_content.replace('<head>', f'<head>{head_content}')
            
            # Add script for text selection communication
            script = """
                <script>
                document.addEventListener('mouseup', function() {
                    const selection = window.getSelection();
                    if (selection && selection.toString().trim()) {
                        window.parent.postMessage({
                            type: 'textSelection',
                            text: selection.toString()
                        }, 'http://localhost:5174');
                    }
                });
                </script>
            """
            html_content = html_content.replace('</head>', f'{script}</head>')
            
            # Add style to make content fit iframe and handle PowerPoint slides properly
            style = """
            <style>
                :root {
                    --slide-ratio: 0.5625; /* 16:9 aspect ratio */
                    --slide-padding: 20px;
                }
                
                html, body {
                    margin: 0;
                    padding: 0;
                    width: 100%;
                    height: 100%;
                    overflow-x: hidden;
                    overflow-y: auto;
                    background: #f5f5f5;
                }
                
                body {
                    padding: var(--slide-padding);
                    box-sizing: border-box;
                    font-family: Arial, sans-serif;
                    font-size: 16px;
                    line-height: 1.5;
                }
                
                /* Slide container */
                .page-break, div[style*="page-break-before"] {
                    display: block;
                    position: relative;
                    width: calc(100% - 2 * var(--slide-padding));
                    max-width: 960px; /* Maximum width for slides */
                    margin: 20px auto;
                    padding: 0;
                    background: white;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    border-radius: 4px;
                    overflow: hidden;
                }
                
                /* Maintain aspect ratio */
                .page-break::before, div[style*="page-break-before"]::before {
                    content: "";
                    display: block;
                    padding-top: calc(var(--slide-ratio) * 100%);
                }
                
                /* Slide content wrapper */
                .page-break > *, div[style*="page-break-before"] > * {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    padding: 40px;
                    box-sizing: border-box;
                    overflow: hidden;
                }
                
                /* Text content */
                p, span {
                    position: relative !important;
                    margin: 0 0 0.5em 0 !important;
                    font-size: 1em !important;
                    line-height: 1.5 !important;
                }
                
                /* Images */
                img {
                    max-width: 100%;
                    height: auto;
                    object-fit: contain;
                }
                
                /* Headings */
                h1 { font-size: 2em !important; }
                h2 { font-size: 1.5em !important; }
                h3 { font-size: 1.17em !important; }
                h4 { font-size: 1em !important; }
                h5 { font-size: 0.83em !important; }
                h6 { font-size: 0.67em !important; }
                
                h1, h2, h3, h4, h5, h6 {
                    margin: 0.5em 0 !important;
                    line-height: 1.2 !important;
                    font-weight: bold !important;
                }
                
                /* Lists */
                ul, ol {
                    margin: 0.5em 0 0.5em 1.5em !important;
                    padding: 0 !important;
                }
                
                li {
                    margin: 0.25em 0 !important;
                    line-height: 1.5 !important;
                }
                
                /* Tables */
                table {
                    border-collapse: collapse;
                    margin: 1em 0 !important;
                    width: auto !important;
                }
                
                td, th {
                    padding: 8px !important;
                    border: 1px solid #ddd !important;
                    font-size: 0.9em !important;
                }
                
                /* Fix positioning */
                [style*="position:"] {
                    position: relative !important;
                }
                
                [style*="left:"], [style*="top:"] {
                    left: auto !important;
                    top: auto !important;
                }
                
                /* Ensure text is readable */
                * {
                    font-family: Arial, sans-serif !important;
                    color: #333 !important;
                    background: transparent !important;
                }
                
                /* Responsive adjustments */
                @media (max-width: 768px) {
                    body {
                        padding: 10px;
                    }
                    
                    .page-break > *, div[style*="page-break-before"] > * {
                        padding: 20px;
                    }
                    
                    :root {
                        --slide-padding: 10px;
                    }
                }
            </style>
            """
            html_content = html_content.replace('</head>', f'{style}</head>')
            
            # Ensure proper doctype and structure
            if not html_content.strip().startswith('<!DOCTYPE'):
                html_content = '<!DOCTYPE html>\n' + html_content
            
            # Fix any remaining absolute positioning
            html_content = re.sub(r'position:\s*absolute\s*;', 'position: relative;', html_content)
            
            logger.info(f"Successfully cleaned HTML content for {content}")
            
            return html_content
            
        except Exception as e:
            logger.error(f"Error cleaning HTML content: {e}")
            raise Exception(f"Failed to clean HTML content: {e}")

    async def convert_to_html(self, file: UploadFile) -> dict:
        """Convert document to HTML with embedded images"""
        if not file or not file.filename:
            return {"error": "No file provided or filename is missing"}
        
        # Ensure LibreOffice is ready
        await self._ensure_libreoffice_ready()
        
        logger.info(f"Starting conversion for file: {file.filename} ({file.content_type})")
        
        # Determine file type and conversion format
        file_ext = file.filename.lower().split('.')[-1]
        
        # Remove any duplicate extensions
        if file_ext == 'pptx' and file.filename.endswith('.pptx.pptx'):
            file_ext = 'pptx'
            file.filename = file.filename[:-5]
        
        # Create unique working directory with short name
        presentation_id = str(uuid.uuid4())[:8]
        work_dir = self.temp_dir / presentation_id
        output_dir = self.documents_dir / presentation_id
        
        try:
            # Create directories with proper permissions check
            for directory in [work_dir, output_dir]:
                directory.mkdir(parents=True, exist_ok=True)
                logger.info(f"Created directory: {directory}")
            
            # Save uploaded file with sanitized name
            original_name = sanitize_filename(file.filename or "document")
            file_path = work_dir / original_name
            
            # Save the uploaded file
            content = await file.read()
            file_path.write_bytes(content)
            logger.info(f"Saved uploaded file to: {file_path}")
            
            # Verify file exists and has content
            if not file_path.exists():
                raise HTTPException(status_code=500, detail="Failed to save uploaded file")
            if file_path.stat().st_size == 0:
                raise HTTPException(status_code=500, detail="Uploaded file is empty")
            
            # Convert to HTML using LibreOffice
            try:
                logger.info("Starting LibreOffice conversion...")
                
                # First, convert to PDF
                pdf_path = work_dir / f"{file_path.stem}.pdf"
                pdf_cmd = [
                    str(self.soffice_path),
                    '--headless',
                    '--norestore',
                    '--nofirststartwizard',
                    '--convert-to',
                    'pdf',
                    '--outdir',
                    str(work_dir),
                    str(file_path)
                ]
                
                logger.info(f"Running PDF conversion command: {' '.join(pdf_cmd)}")
                
                # Kill any existing LibreOffice processes first
                process_monitor.cleanup_processes()
                
                # Run PDF conversion
                pdf_process = subprocess.run(
                    pdf_cmd,
                    capture_output=True,
                    text=True,
                    timeout=60,
                    check=False
                )
                
                if pdf_process.stdout:
                    logger.info(f"PDF conversion stdout: {pdf_process.stdout}")
                if pdf_process.stderr:
                    logger.warning(f"PDF conversion stderr: {pdf_process.stderr}")
                
                # Check if PDF was created
                if not pdf_path.exists():
                    logger.error("PDF file was not created")
                    raise HTTPException(status_code=500, detail="Failed to create PDF")
                
                logger.info(f"PDF created successfully at: {pdf_path}")
                
                # Now convert PDF to HTML
                html_cmd = [
                    str(self.soffice_path),
                    '--headless',
                    '--norestore',
                    '--nofirststartwizard',
                    '--convert-to',
                    'html',  # Simplified format
                    '--outdir',
                    str(output_dir),
                    str(pdf_path)
                ]
                
                logger.info(f"Running HTML conversion command: {' '.join(html_cmd)}")
                
                # Kill any remaining processes
                process_monitor.cleanup_processes()
                
                # Run HTML conversion
                html_process = subprocess.run(
                    html_cmd,
                    capture_output=True,
                    text=True,
                    timeout=60,
                    check=False
                )
                
                if html_process.stdout:
                    logger.info(f"HTML conversion stdout: {html_process.stdout}")
                if html_process.stderr:
                    logger.warning(f"HTML conversion stderr: {html_process.stderr}")
                
                # Wait a moment for file system to sync
                await asyncio.sleep(1)
                
                # Look for the converted HTML file
                html_files = list(output_dir.glob('*.html')) + list(output_dir.glob('*.HTML'))
                if not html_files:
                    all_files = list(output_dir.glob('*'))
                    logger.error(f"No HTML files found. Directory contents: {[f.name for f in all_files]}")
                    raise HTTPException(status_code=500, detail="No HTML file was generated during conversion")
                
                html_file = html_files[0]
                logger.info(f"Found converted HTML file: {html_file}")
                
                # Verify the HTML file exists and has content
                if not html_file.exists():
                    raise HTTPException(status_code=500, detail=f"Generated HTML file does not exist: {html_file}")
                
                if html_file.stat().st_size == 0:
                    raise HTTPException(status_code=500, detail=f"Generated HTML file is empty: {html_file}")
                
                # Clean the HTML content
                cleaned_content = self._clean_html_content(html_file)
                html_file.write_text(cleaned_content, encoding='utf-8')
                
                # Return the relative path for frontend
                relative_path = html_file.relative_to(self.documents_dir.parent)
                url_path = str(relative_path).replace('\\', '/')
                
                logger.info(f"Successfully converted file. URL path: /documents/{url_path}")
                
                return {
                    "status": "success",
                    "url": f"/documents/{url_path}"
                }
                
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Error during conversion: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Error during conversion: {str(e)}")
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error in conversion: {e}")
            raise HTTPException(status_code=500, detail=str(e))
        finally:
            # Clean up the work directory after a delay to ensure files are accessible
            self._schedule_cleanup(work_dir, delay=300)  # Clean up after 5 minutes

    def _schedule_cleanup(self, directory: Path, delay: int = 3600):
        """Schedule directory cleanup after specified delay (default 1 hour)"""
        def cleanup():
            time.sleep(delay)
            try:
                if directory.exists():
                    shutil.rmtree(directory, ignore_errors=True)
                    logger.info(f"Cleaned up directory: {directory}")
            except Exception as e:
                logger.error(f"Error cleaning up directory {directory}: {str(e)}")
        
        Thread(target=cleanup).start()

    async def convert_pptx_to_pdf(self, input_path: str, output_dir: str) -> tuple[bool, str]:
        """Convert PowerPoint to PDF with selectable text using LibreOffice"""
        try:
            # Determine PDF output path
            pdf_path = f"{output_dir}/presentation.pdf"
            
            # Platform-specific command
            if os.name == 'nt':  # Windows
                cmd = [
                    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
                    '--headless', '--convert-to', 'pdf',
                    '--outdir', output_dir, input_path
                ]
            else:  # Linux (Railway)
                cmd = [
                    'libreoffice', '--headless', '--convert-to', 'pdf',
                    '--outdir', output_dir, input_path
                ]
            
            # Log the command for debugging
            logger.info(f"Running LibreOffice command: {' '.join(cmd)}")
            
            # Run conversion process with timeout
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            try:
                stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=60)
                if process.returncode != 0:
                    error_msg = stderr.decode() if stderr else "Unknown error"
                    logger.error(f"Conversion failed with code {process.returncode}: {error_msg}")
                    return False, f"Conversion failed: {error_msg}"
                
                # Verify PDF was created
                if os.path.exists(pdf_path):
                    logger.info(f"PDF created successfully at {pdf_path}")
                    return True, pdf_path
                else:
                    # Try to find the PDF file (LibreOffice might rename it)
                    pdf_files = list(Path(output_dir).glob("*.pdf"))
                    if pdf_files:
                        logger.info(f"PDF created with different name at {pdf_files[0]}")
                        return True, str(pdf_files[0])
                    else:
                        logger.error("PDF file not created")
                        return False, "PDF file not created"
                
            except asyncio.TimeoutError:
                logger.error("Conversion timed out after 60 seconds")
                process.kill()
                return False, "Conversion timed out"
            
        except Exception as e:
            logger.error(f"Error converting to PDF: {str(e)}")
            return False, f"Error converting to PDF: {str(e)}"

    async def process_presentation_legacy(self, input_path: str, output_dir: str, doc_id: str):
        """Process presentation in background (legacy method)"""
        try:
            # Update status to processing
            with open(f"{output_dir}/status.json", "w") as f:
                json.dump({"status": "processing", "document_id": doc_id}, f)
            
            # Convert to PDF
            success, result = await self.convert_pptx_to_pdf(input_path, output_dir)
            
            if not success:
                # Update status file with error
                with open(f"{output_dir}/status.json", "w") as f:
                    json.dump({"status": "failed", "error": result, "document_id": doc_id}, f)
                return
            
            # PDF path is in the result variable
            pdf_path = result
            
            # Create status file
            with open(f"{output_dir}/status.json", "w") as f:
                json.dump({
                    "status": "completed",
                    "document_id": doc_id,
                    "files": {
                        "pdf": f"/api/presentations/files/{doc_id}/presentation.pdf"
                    }
                }, f)
            
        except Exception as e:
            logger.error(f"Error processing presentation: {str(e)}")
            # Log error and update status
            with open(f"{output_dir}/status.json", "w") as f:
                json.dump({"status": "failed", "error": str(e), "document_id": doc_id}, f) 