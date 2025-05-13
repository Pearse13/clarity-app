# PowerPoint to PDF Conversion Roadmap

## Overview
This roadmap outlines the implementation plan for converting PowerPoint presentations to PDF format while maintaining text selectability. This feature will be integrated into the Clarity Lectures (Understand) module to preserve original formatting, fonts, images, and layouts while allowing users to interact with the text.

## Phase 1: Backend Implementation (2-3 days)

### 1.1 LibreOffice Integration (Day 1)
- [ ] Configure LibreOffice for headless operation in the backend
- [ ] Create Docker configuration for Railway deployment with LibreOffice
- [ ] Implement environment detection for cross-platform compatibility
- [ ] Test LibreOffice installation and configuration in Docker environment

### 1.2 PowerPoint to PDF Conversion Service (Day 1-2)
- [ ] Implement `convert_pptx_to_pdf` function using LibreOffice headless mode
- [ ] Add proper error handling and timeout management
- [ ] Create background task processing for asynchronous conversion
- [ ] Implement status tracking and notification system
- [ ] Add logging for debugging and monitoring

### 1.3 API Endpoints (Day 2)
- [ ] Create/update upload endpoint for PowerPoint files
- [ ] Implement status checking endpoint for conversion progress
- [ ] Add PDF retrieval endpoint with proper caching headers
- [ ] Create endpoint for text extraction from the PDF
- [ ] Document API endpoints for frontend integration

### 1.4 Testing and Optimization (Day 2-3)
- [ ] Test with various PowerPoint formats (.ppt, .pptx)
- [ ] Test with presentations containing different elements (images, charts, tables)
- [ ] Optimize conversion process for speed and reliability
- [ ] Implement file cleanup and storage management
- [ ] Add unit and integration tests

## Phase 2: Frontend Implementation (2-3 days)

### 2.1 PDF.js Integration (Day 1)
- [ ] Add PDF.js library to the frontend project
- [ ] Configure PDF.js worker for optimal performance
- [ ] Create basic PDF viewer component
- [ ] Implement text layer for selection capability
- [ ] Test cross-browser compatibility

### 2.2 UI Enhancement (Day 1-2)
- [ ] Style the PDF viewer to match application design
- [ ] Add zoom controls and navigation features
- [ ] Implement responsive design for mobile compatibility
- [ ] Add loading states and error handling
- [ ] Implement text selection highlighting

### 2.3 Text Interaction Features (Day 2)
- [ ] Implement text selection event handlers
- [ ] Create context menu for selected text
- [ ] Add "Transform Selected Text" functionality
- [ ] Implement "Copy to Clipboard" feature
- [ ] Add "Search in Document" capability

### 2.4 Testing and Refinement (Day 2-3)
- [ ] Test with various PDF documents
- [ ] Optimize rendering performance
- [ ] Ensure accessibility compliance
- [ ] Fix any browser-specific issues
- [ ] Gather user feedback and make adjustments

## Phase 3: Standalone Server Implementation on Railway (2-3 days)

### 3.1 Railway Project Setup (Day 1)
- [ ] Create new Railway project for the standalone backend
- [ ] Configure project settings and environment variables
- [ ] Set up GitHub integration for continuous deployment
- [ ] Configure resource allocation (RAM, CPU, storage)
- [ ] Set up monitoring and logging

### 3.2 Docker Configuration (Day 1)
- [ ] Create Dockerfile with LibreOffice and Python dependencies
- [ ] Configure container environment for headless operation
- [ ] Set up volume storage for document persistence
- [ ] Implement health checks and restart policies
- [ ] Test Docker build locally

### 3.3 API Gateway Implementation (Day 1-2)
- [ ] Create Vercel API gateway to proxy requests to Railway
- [ ] Implement authentication and authorization checks
- [ ] Set up CORS and security headers
- [ ] Configure rate limiting and request validation
- [ ] Test end-to-end communication

### 3.4 Deployment and Testing (Day 2-3)
- [ ] Deploy Docker container to Railway
- [ ] Configure custom domain (if needed)
- [ ] Set up SSL/TLS certificates
- [ ] Implement CI/CD pipeline for automated deployments
- [ ] Perform load testing and optimization

### 3.5 Monitoring and Maintenance (Day 3)
- [ ] Set up Sentry integration for error tracking
- [ ] Configure performance monitoring
- [ ] Implement automated backups
- [ ] Create alerting for critical issues
- [ ] Document deployment and maintenance procedures

## Phase 4: Deployment and Integration (1-2 days)

### 4.1 Railway Deployment (Day 1)
- [ ] Update Dockerfile with LibreOffice configuration
- [ ] Configure environment variables for production
- [ ] Deploy updated backend to Railway
- [ ] Test conversion in production environment
- [ ] Monitor performance and resource usage

### 4.2 Frontend Deployment (Day 1)
- [ ] Build and deploy frontend with PDF.js integration
- [ ] Verify PDF.js worker is properly loaded
- [ ] Test end-to-end functionality in production
- [ ] Monitor for any client-side errors

### 4.3 Documentation and Training (Day 1-2)
- [ ] Update user documentation with new features
- [ ] Create internal documentation for maintenance
- [ ] Document common issues and troubleshooting steps
- [ ] Create user guide for PowerPoint preparation best practices

## Phase 5: Extension to Other Document Types (Future)

### 5.1 Word Document Support
- [ ] Extend conversion functionality to Word documents
- [ ] Test with various Word formats and features
- [ ] Update UI to handle Word-specific elements

### 5.2 PDF Direct Upload Support
- [ ] Add direct PDF upload and processing
- [ ] Implement PDF text extraction and indexing
- [ ] Create unified document viewer interface

### 5.3 Additional Format Support
- [ ] Add support for Google Slides exports
- [ ] Implement Excel/spreadsheet conversion
- [ ] Support for Markdown and plain text files

## Technical Implementation Details

### Backend (FastAPI)
```python
async def convert_pptx_to_pdf(input_path: str, output_dir: str) -> tuple[bool, str]:
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
        
        # Run conversion process with timeout
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        try:
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=60)
            if process.returncode != 0:
                return False, f"Conversion failed: {stderr.decode()}"
            
            # Verify PDF was created
            if os.path.exists(pdf_path):
                return True, pdf_path
            else:
                # Try to find the PDF file (LibreOffice might rename it)
                pdf_files = list(Path(output_dir).glob("*.pdf"))
                if pdf_files:
                    return True, str(pdf_files[0])
                else:
                    return False, "PDF file not created"
            
        except asyncio.TimeoutError:
            process.kill()
            return False, "Conversion timed out"
            
    except Exception as e:
        return False, f"Error converting to PDF: {str(e)}"
```

### Frontend (React/TypeScript)
```typescript
import { useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import 'pdfjs-dist/web/pdf_viewer.css';

// Set the worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

interface PDFViewerProps {
  pdfUrl: string;
  onTextSelect?: (text: string) => void;
}

const PDFViewer: React.FC<PDFViewerProps> = ({ pdfUrl, onTextSelect }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const loadPdf = async () => {
      try {
        // Load the PDF document
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        
        // Load the first page
        const page = await pdf.getPage(1);
        
        // Set scale for rendering
        const scale = 1.5;
        const viewport = page.getViewport({ scale });
        
        // Prepare canvas for rendering
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        // Add canvas to container
        containerRef.current?.appendChild(canvas);
        
        // Render PDF page to canvas
        const renderContext = {
          canvasContext: context!,
          viewport: viewport
        };
        
        await page.render(renderContext).promise;
        
        // Create text layer for selection
        const textContent = await page.getTextContent();
        const textLayerDiv = document.createElement('div');
        textLayerDiv.className = 'textLayer';
        textLayerDiv.style.width = `${viewport.width}px`;
        textLayerDiv.style.height = `${viewport.height}px`;
        containerRef.current?.appendChild(textLayerDiv);
        
        // Render text layer
        pdfjsLib.renderTextLayer({
          textContent: textContent,
          container: textLayerDiv,
          viewport: viewport,
          textDivs: []
        });
        
        // Add text selection event listener
        if (onTextSelect) {
          textLayerDiv.addEventListener('mouseup', () => {
            const selection = window.getSelection();
            if (selection && selection.toString().trim()) {
              onTextSelect(selection.toString());
            }
          });
        }
      } catch (error) {
        console.error('Error loading PDF:', error);
      }
    };

    loadPdf();
  }, [pdfUrl, onTextSelect]);

  return <div className="pdf-container" ref={containerRef}></div>;
};

export default PDFViewer;
```

### Docker Configuration for Railway
```dockerfile
FROM ubuntu:22.04

# Install LibreOffice and dependencies
RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-dev \
    libreoffice \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    fonts-liberation \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set up working directory
WORKDIR /app

# Copy requirements first for better caching
COPY backend/requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy the backend code
COPY backend/ .

# Expose the port
EXPOSE 8000

# Run the server
CMD ["python3", "run_server.py"]
```

### Vercel API Gateway
```javascript
// api/[...path].js
export default async function handler(req, res) {
  const { path } = req.query;
  const backendUrl = process.env.BACKEND_URL;
  
  try {
    // Forward the request to Railway
    const response = await fetch(`${backendUrl}/${path.join('/')}`, {
      method: req.method,
      headers: {
        ...req.headers,
        'x-forwarded-host': req.headers.host,
        'x-forwarded-proto': 'https',
        'x-api-key': process.env.INTERNAL_API_KEY
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? 
            JSON.stringify(req.body) : undefined
    });
    
    // Get the response data
    const data = await response.text();
    
    // Set the appropriate status and headers
    res.status(response.status);
    for (const [key, value] of response.headers.entries()) {
      res.setHeader(key, value);
    }
    
    // Send the response
    res.send(data);
  } catch (error) {
    console.error('Backend proxy error:', error);
    res.status(500).json({ error: 'Failed to reach backend service' });
  }
}
```

## Resource Requirements

1. **Development Resources**
   - 1 Backend Developer (5-7 days)
   - 1 Frontend Developer (4-6 days)
   - 1 DevOps Engineer (1-2 days for deployment)

2. **Infrastructure**
   - Railway.app with at least 1GB RAM
   - Storage for PDF files (S3 or Railway volume storage)
   - CDN for serving PDF files (optional)

3. **Dependencies**
   - LibreOffice (backend)
   - PDF.js (frontend)
   - Additional Python packages: asyncio, aiofiles

## Railway Standalone Server Costs

1. **Starter Plan**
   - Base cost: $5/month
   - Usage-based costs: ~$5-15/month (for 100 users)
   - Total estimated cost: $10-20/month

2. **Resource Allocation**
   - Memory: 1GB RAM minimum
   - CPU: 1 vCPU
   - Storage: 5GB minimum
   - Bandwidth: Included in usage-based pricing

3. **Cost Optimization**
   - Implement caching to reduce processing needs
   - Use efficient file storage and cleanup
   - Consider scheduled scaling for peak usage times

## Success Metrics

1. **Conversion Success Rate**
   - Target: >95% successful conversions
   - Measure: Ratio of successful conversions to total attempts

2. **Conversion Speed**
   - Target: <30 seconds for typical presentations
   - Measure: Average conversion time

3. **User Satisfaction**
   - Target: >90% positive feedback
   - Measure: User feedback and satisfaction surveys

4. **Text Selection Accuracy**
   - Target: >95% accuracy in text selection
   - Measure: Comparison of selected text to original content

5. **Server Performance**
   - Target: <500ms API response time (excluding conversion)
   - Target: <1% error rate
   - Measure: Railway monitoring metrics

## Timeline

Total estimated implementation time: **7-10 working days**

- Phase 1 (Backend): 2-3 days
- Phase 2 (Frontend): 2-3 days
- Phase 3 (Standalone Server): 2-3 days
- Phase 4 (Deployment): 1-2 days
- Future phases: To be scheduled based on priority 