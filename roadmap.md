# Roadmap for "Clarity" Web App

**Overview**  
Clarity is a dual-purpose AI-powered educational platform consisting of two main features:
1. **Text Transformer**: An intelligent text refinement tool offering four transformation modes with varying intensity levels for enhancing written communication.
2. **Clarity.lecture**: An interactive learning companion that transforms educational content into digestible formats with AI-powered comprehension tools.

**Tech Stack** ✓
- Frontend: React + Vite (Deployed on Vercel)
- Backend: FastAPI (Deployed on Vercel)
- Authentication: Auth0 with Google OAuth
- Monitoring: Sentry
- Development: GitHub

---

## 1. Core Infrastructure ✓
1. FastAPI backend with ASGI server configuration
2. React frontend with Vite and TypeScript
3. Auth0 integration for secure authentication
4. OpenAI API integration for text transformation
5. Environment configuration for development and production
6. Sentry integration for error tracking and monitoring
7. Vercel deployment for frontend and backend

## 2. Authentication System
1. Auth0 Core Setup ✓
   - SPA Application configuration
   - JWT validation with RS256
   - Protected routes implementation
   - Token management and refresh handling
   - Login/logout flow with proper redirects
   - Error handling for authentication failures

2. API Authorization ✓
   - Custom API setup (clarity-api.com)
   - Access token configuration (24h lifetime)
   - Audience validation
   - Scope management
   - Token refresh configuration

3. Social Authentication ✓
   - Google OAuth integration
   - Basic profile permissions
   - Secure callback handling
   - Multiple environment support (local, production)

4. Advanced Auth Features
   - Additional social providers
   - Enhanced user profiles
   - Role-based access control (RBAC)
   - Custom user metadata
   - Multi-factor authentication
   - Organization support

## 3. Text Transformer Features ✓
1. Four transformation modes:
   - Simplify: Makes text clearer and more accessible
   - Sophisticate: Enhances vocabulary and structure
   - Casualise: Creates a relaxed, approachable style
   - Formalise: Polishes text for professionalism
2. Five intensity levels for each mode
3. Character limit validation (250 chars)
4. Real-time transformation feedback
5. Error handling for API failures

## 4. Clarity.lecture Development Roadmap

### Phase 1: Document Processing Foundation
1. File Upload System ✓
   - Support for PowerPoint files (.ppt, .pptx) ✓
   - Support for Word documents (.doc, .docx)
   - Support for PDF files ✓
   - Drag-and-drop interface with progress indicators ✓
   - File size limits and type validation ✓
   - Secure file storage in local filesystem ✓
   - Backend route for file upload and processing ✓
   - File preview functionality ✓

2. Document Conversion Pipeline ✓
   - PowerPoint to HTML conversion using LibreOffice ✓
   - Word document to HTML conversion using LibreOffice
   - PDF rendering using PDF.js
   - Conversion status tracking and error handling ✓
   - Background processing for large files ✓
   - Process monitoring and cleanup for LibreOffice processes ✓

3. Document Viewer Interface
   - Unified viewer for all document types (PowerPoint, Word, PDF)
   - Responsive design for different screen sizes
   - Zoom and navigation controls
   - Thumbnail navigation for multi-page documents
   - Dark/light mode support
   - Mobile-friendly viewing experience
   - Loading states and error handling ✓
   - Retry mechanism for failed loads ✓

### Phase 2: Enhanced Document Processing
1. Text Extraction and Analysis
   - Extract text content from all document types
   - Maintain document structure and formatting information
   - Section detection and hierarchical organization
   - Metadata extraction (titles, headers, page numbers)
   - Image extraction and handling
   - Table detection and processing
   - Equation detection and rendering

2. Document Indexing and Search
   - Full-text indexing of document content
   - Search functionality within documents
   - Keyword highlighting in search results
   - Search across multiple documents
   - Filter and sort search results
   - Search history and saved searches

3. Content Organization
   - Table of contents generation
   - Page mapping and navigation
   - Bookmark and favorites system
   - Document categorization and tagging
   - Related documents suggestion
   - Recent documents tracking

### Phase 3: AI-Powered Comprehension Tools
1. Document Viewer
   - Split-screen layout (content + interaction panel)
   - Smooth scrolling and navigation
   - Text selection and highlighting
   - Dark/light mode support
   - Zoom and text size controls
   - Mobile-responsive design
   - Progress tracking

2. AI-Powered Comprehension Tools
   - Text selection for transformation
   - Context-aware explanations using GPT-4
   - Term definitions and examples
   - Concept breakdown visualization
   - Related concepts mapping
   - Custom GPT prompts for education

3. Interactive Features
   - Inline comments and notes
   - Highlight organization and categorization
   - Collaborative annotations
   - Voice notes integration
   - Real-time collaboration support
   - Bookmark and favorites system

### Phase 4: Study Material Generation
1. Smart Summarization
   - Multi-level summary generation (brief, detailed, comprehensive)
   - Chapter and section summaries
   - Key points extraction
   - Topic clustering and organization
   - Visual summary maps
   - Custom summary preferences

2. Learning Materials
   - Automated flashcard generation
   - Practice quiz creation with difficulty levels
   - Exercise problem generation
   - Study guide compilation
   - Custom exercise templates
   - Answer explanations

3. Content Enhancement
   - Related resource suggestions
   - External reference integration
   - Multimedia content suggestions
   - Interactive diagrams
   - Code snippet handling
   - Mathematical equation support

### Phase 5: Progress Tracking & Analytics
1. Learning Dashboard
   - Study session tracking
   - Time spent analysis
   - Comprehension assessments
   - Progress visualization
   - Learning pace metrics
   - Custom goals and milestones

2. Performance Analytics
   - Quiz and exercise performance tracking
   - Knowledge gap identification
   - Learning style analysis
   - Study pattern insights
   - Retention rate tracking
   - Personalized recommendations

3. Reporting System
   - Progress reports generation
   - Performance trend analysis
   - Study habit insights
   - Export functionality
   - Custom report templates
   - Data visualization

### Phase 6: Advanced Features
1. AI Tutor Integration
   - Personalized learning paths
   - Adaptive difficulty adjustment
   - Interactive Q&A sessions
   - Concept explanations
   - Real-time feedback
   - Learning style adaptation

2. Collaboration Features
   - Study group creation
   - Document sharing
   - Collaborative annotations
   - Discussion threads
   - Peer review system
   - Teacher-student interaction

3. Integration & Export
   - LMS integration (Canvas, Blackboard)
   - Export to various formats
   - API for external tools
   - Mobile app sync
   - Cloud backup
   - Offline mode support

### Technical Implementation Details
1. Frontend Architecture
   ```typescript
   // Core components structure
   src/
     components/
       document/
         DocumentViewer.tsx
         FileUploader.tsx
         DocumentControls.tsx
         ThumbnailNavigator.tsx
       common/
         LoadingIndicator.tsx
         ErrorDisplay.tsx
         RetryButton.tsx
     pages/
       lecture/
         Dashboard.tsx
         DocumentView.tsx
         Library.tsx
     hooks/
       useDocumentUpload.ts
       useDocumentViewer.ts
       useDocumentConversion.ts
     services/
       documentService.ts
       conversionService.ts
       storageService.ts
   ```

2. Backend Architecture
   ```python
   # Core services structure
   app/
     routers/
       documents.py
       presentations.py
       pdfs.py
     services/
       document_service.py
       presentation_service.py
       pdf_service.py
       conversion_service.py
       storage_service.py
     models/
       document.py
       conversion.py
       user_document.py
   ```

3. Database Schema
   ```sql
   -- Core tables
   CREATE TABLE documents (
     id UUID PRIMARY KEY,
     user_id UUID,
     filename TEXT,
     original_filename TEXT,
     file_type TEXT,
     file_size BIGINT,
     status TEXT,
     created_at TIMESTAMP,
     updated_at TIMESTAMP
   );

   CREATE TABLE document_conversions (
     id UUID PRIMARY KEY,
     document_id UUID REFERENCES documents(id),
     output_format TEXT,
     output_path TEXT,
     status TEXT,
     error_message TEXT,
     started_at TIMESTAMP,
     completed_at TIMESTAMP
   );

   CREATE TABLE document_metadata (
     id UUID PRIMARY KEY,
     document_id UUID REFERENCES documents(id),
     page_count INTEGER,
     title TEXT,
     author TEXT,
     created_date TIMESTAMP,
     modified_date TIMESTAMP,
     metadata JSONB
   );
   ```

### Development Phases Timeline
1. Phase 1: Document Processing Foundation
   - Duration: 3-4 weeks
   - Key Milestone: Complete document upload, conversion, and viewing for all supported file types

2. Phase 2: Enhanced Document Processing
   - Duration: 4-5 weeks
   - Key Milestone: Text extraction, indexing, and content organization

3. Phase 3: AI-Powered Comprehension Tools
   - Duration: 5-6 weeks
   - Key Milestone: Interactive learning interface with AI tools

4. Phase 4: Study Material Generation
   - Duration: 4-5 weeks
   - Key Milestone: Automated study material creation

5. Phase 5: Progress Tracking & Analytics
   - Duration: 4-5 weeks
   - Key Milestone: Complete learning dashboard

6. Phase 6: Advanced Features
   - Duration: 6-8 weeks
   - Key Milestone: Full feature set with integrations

Total Estimated Timeline: 26-33 weeks

### Testing Strategy
1. Unit Testing
   - Document processing functions
   - AI integration points
   - Data transformation logic
   - Analytics calculations

2. Integration Testing
   - File upload flow
   - AI service integration
   - Database operations
   - User progress tracking

3. End-to-End Testing
   - Complete user workflows
   - Performance testing
   - Mobile responsiveness
   - Offline functionality

4. User Acceptance Testing
   - Beta testing program
   - Feature validation
   - Performance metrics
   - User feedback collection

## 8. Document Upload and Viewing Implementation Plan

### 1. Frontend Implementation

#### File Upload Component
```typescript
// FileUploader.tsx
import React, { useState } from 'react';
import { Upload, AlertCircle } from 'lucide-react';

interface FileUploaderProps {
  onFileSelected: (file: File) => Promise<void>;
  supportedFileTypes: string[];
  maxFileSize: number;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  onFileSelected,
  supportedFileTypes,
  maxFileSize
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    const fileExt = `.${file.name.split('.').pop()?.toLowerCase()}`;
    if (!supportedFileTypes.includes(fileExt)) {
      setError(`Unsupported file type. Please upload: ${supportedFileTypes.join(', ')}`);
      return;
    }
    
    // Validate file size
    if (file.size > maxFileSize) {
      setError(`File too large. Maximum size: ${maxFileSize / (1024 * 1024)}MB`);
      return;
    }
    
    try {
      setUploading(true);
      setError(null);
      await onFileSelected(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <div className="upload-container">
      {/* Component implementation */}
    </div>
  );
};
```

#### Document Viewer Component
```typescript
// DocumentViewer.tsx
import React, { useState, useEffect } from 'react';
import { useDocumentViewer } from '../../hooks/useDocumentViewer';
import { DocumentControls } from './DocumentControls';
import { ThumbnailNavigator } from './ThumbnailNavigator';
import { LoadingIndicator, ErrorDisplay, RetryButton } from '../common';

interface DocumentViewerProps {
  documentId: string;
  documentType: 'pdf' | 'powerpoint' | 'word';
  viewerUrl: string;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  documentId,
  documentType,
  viewerUrl
}) => {
  const { 
    loading, 
    error, 
    currentPage, 
    totalPages,
    zoom,
    setCurrentPage,
    setZoom,
    retryLoading
  } = useDocumentViewer(documentId, documentType);
  
  return (
    <div className="document-viewer-container">
      {loading && <LoadingIndicator />}
      {error && (
        <ErrorDisplay 
          message={error} 
          action={<RetryButton onClick={retryLoading} />} 
        />
      )}
      <div className="document-viewer-content">
        <ThumbnailNavigator 
          documentId={documentId}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageSelect={setCurrentPage}
        />
        <div className="document-main-view">
          <DocumentControls 
            zoom={zoom}
            currentPage={currentPage}
            totalPages={totalPages}
            onZoomChange={setZoom}
            onPageChange={setCurrentPage}
          />
          <iframe 
            src={viewerUrl}
            className="document-iframe"
            title={`Document ${documentId}`}
            sandbox="allow-same-origin allow-scripts"
          />
        </div>
      </div>
    </div>
  );
};
```

### 2. Backend Implementation

#### Document Router
```python
# app/routers/documents.py
from fastapi import APIRouter, UploadFile, HTTPException, Request, BackgroundTasks
from ..services.document_service import DocumentService
from ..services.storage_service import StorageService
import logging
import uuid
from typing import Dict, Any

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/documents", tags=["documents"])

document_service = DocumentService()
storage_service = StorageService()

SUPPORTED_FILE_TYPES = {
    '.pdf': 'PDF',
    '.doc': 'Word',
    '.docx': 'Word',
    '.ppt': 'PowerPoint',
    '.pptx': 'PowerPoint'
}

@router.post("/upload")
async def upload_document(
    request: Request,
    file: UploadFile,
    background_tasks: BackgroundTasks
) -> Dict[str, Any]:
    """Upload and process a document file"""
    # Implementation details
    pass

@router.get("/status/{doc_id}")
async def check_status(doc_id: str) -> Dict[str, Any]:
    """Check the processing status of a document"""
    # Implementation details
    pass

@router.get("/view/{doc_id}")
async def view_document(doc_id: str, request: Request):
    """Get the viewer URL for a document"""
    # Implementation details
    pass

@router.get("/metadata/{doc_id}")
async def get_document_metadata(doc_id: str) -> Dict[str, Any]:
    """Get metadata for a document"""
    # Implementation details
    pass
```

#### Document Service
```python
# app/services/document_service.py
from pathlib import Path
import uuid
import os
from typing import Dict, Any, Tuple
from fastapi import UploadFile, HTTPException
import logging
from ..services.conversion_service import ConversionService
from ..services.storage_service import StorageService

logger = logging.getLogger(__name__)

class DocumentService:
    def __init__(self):
        self.conversion_service = ConversionService()
        self.storage_service = StorageService()
        self.data_dir = Path("data/documents")
        self.data_dir.mkdir(parents=True, exist_ok=True)
    
    async def process_document(self, file: UploadFile) -> Dict[str, Any]:
        """Process an uploaded document file"""
        # Implementation details
        pass
    
    async def get_document_status(self, doc_id: str) -> Dict[str, Any]:
        """Get the processing status of a document"""
        # Implementation details
        pass
    
    async def get_document_metadata(self, doc_id: str) -> Dict[str, Any]:
        """Get metadata for a document"""
        # Implementation details
        pass
    
    async def get_document_viewer_url(self, doc_id: str) -> str:
        """Get the URL for viewing a document"""
        # Implementation details
        pass
```

### 3. Implementation Priorities

1. **Week 1: Core Upload and Storage**
   - Implement file upload component with validation
   - Create backend routes for file upload
   - Implement secure file storage
   - Add file type detection and validation
   - Implement basic error handling

2. **Week 2: Document Conversion**
   - Implement PowerPoint to HTML conversion
   - Add Word document to HTML conversion
   - Implement PDF rendering
   - Create background processing for conversions
   - Add conversion status tracking

3. **Week 3: Document Viewer**
   - Create unified document viewer component
   - Implement viewer controls (zoom, navigation)
   - Add thumbnail navigation for multi-page documents
   - Implement loading states and error handling
   - Add retry mechanism for failed loads

4. **Week 4: Refinement and Testing**
   - Optimize performance for large documents
   - Implement responsive design for different screen sizes
   - Add dark/light mode support
   - Conduct thorough testing across different file types
   - Fix bugs and edge cases

### 4. Technical Considerations

1. **Performance Optimization**
   - Use streaming uploads for large files
   - Implement background processing for conversions
   - Optimize HTML output for faster rendering
   - Use lazy loading for thumbnails and pages
   - Implement caching for frequently accessed documents

2. **Security Considerations**
   - Validate file types and content
   - Sanitize HTML output to prevent XSS
   - Implement proper file permissions
   - Use secure file storage with access controls
   - Regularly clean up temporary files

3. **User Experience**
   - Provide clear feedback during upload and processing
   - Implement intuitive navigation controls
   - Ensure responsive design for all screen sizes
   - Add keyboard shortcuts for common actions
   - Provide helpful error messages and recovery options

## 5. Enhanced Features
1. Text Transformer Improvements
   - Bulk text processing
   - Custom transformation templates
   - Transformation history
   - Export functionality
   - Style presets

2. User Experience
   - Dark mode support
   - Mobile responsiveness
   - Keyboard shortcuts
   - Custom presets
   - User preferences (Auth0 user metadata)
   - Cross-device sync

3. Advanced Capabilities
   - API rate limiting (Vercel)
   - Usage quotas
   - Premium features
   - Team collaboration
   - API access
   - Integration options

## 6. Technical Optimization
1. Performance
   - Vercel Edge Functions
   - Vercel CDN
   - Response optimization
   - Bundle size reduction
   - Load time improvement
   - Resource efficiency

2. Security
   - Auth0 security features
   - Rate limiting
   - Input validation
   - Security audits
   - Vulnerability scanning

3. Monitoring
   - Sentry error tracking ✓
   - Sentry performance monitoring ✓
   - Vercel analytics
   - Usage analytics
   - Automated testing
   - CI/CD pipeline (GitHub Actions)

## 7. Production Infrastructure
1. Deployment
   - Vercel frontend deployment ✓
   - Vercel backend deployment ✓
   - Database implementation
   - File storage solution
   - Load balancing (Vercel)
   - Scaling automation (Vercel)

2. Documentation
   - API documentation
   - User guides
   - Developer docs
   - Deployment guides
   - Integration tutorials

3. Compliance & Legal
   - GDPR compliance
   - Data privacy
   - Terms of service
   - Privacy policy
   - Cookie policy
   - Auth0 compliance features
