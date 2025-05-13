import React, { useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Upload } from 'lucide-react';
import { PDFViewer } from '../pdf/PDFViewer';
import { PowerPointViewer } from '../powerpoint/PowerPointViewer';
import { WordViewer } from '../word/WordViewer';

// Debug log for environment variables
console.log('Environment variables:', {
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_PRODUCTION_API_URL: import.meta.env.VITE_PRODUCTION_API_URL
});

// Type definitions
type PresentationViewerProps = {
  onTextSelect?: (text: string, extractedText?: string) => void;
  onDocumentTextExtracted?: (text: string | null) => void;
  onReset?: () => void;
};

type PresentationData = {
  id: string;
  document_id: string;
  status: 'ready' | 'processing' | 'error';
  url: string;
  filename: string;
  type: string;
  apiUrl?: string;
  isPowerPoint?: boolean;
  isWord?: boolean;
};

type FileStatusResponse = {
  document_id: string;
  status: 'ready' | 'processing' | 'error';
  filename?: string;
  file_url?: string;
  error?: string;
};

const SUPPORTED_FILE_TYPES = {
  '.ppt': 'PowerPoint',
  '.pptx': 'PowerPoint',
  '.doc': 'Word',
  '.docx': 'Word',
  '.pdf': 'PDF'
};

// Export the component with forwardRef
export const PresentationViewer = forwardRef<
  { resetPresentation: () => void },
  PresentationViewerProps
>(({ 
  onTextSelect, 
  onDocumentTextExtracted, 
  onReset
}, ref) => {
  const [isLoading, setIsLoading] = useState(false);
  const [presentationData, setPresentationData] = useState<PresentationData | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<'idle' | 'uploading' | 'processing' | 'converting'>('idle');
  const [uploadMessage, setUploadMessage] = useState<string>('Uploading file...');

  // Clean up selected text
  const cleanSelectedText = (text: string): string => {
    return text.replace(/slide \* {[^}]*}|[a-z]+ {[^}]*}/gi, '')
      .replace(/\s+/g, ' ')
      .replace(/^\s*[\r\n]/gm, '')
      .trim();
  };

  // Handle text selection from PDF viewer
  const handlePDFTextSelection = useCallback((text: string, extractedDocText?: string) => {
    if (text && onTextSelect) {
      const cleanText = cleanSelectedText(text);
      if (cleanText) {
        onTextSelect(cleanText, extractedDocText);
      }

    }
  }, [onTextSelect, cleanSelectedText]);

  // Prevent text selection outside viewer
  useEffect(() => {
    if (!onTextSelect) return;
    
    const preventDocumentSelection = (e: MouseEvent) => {
      if (!presentationData) return;
      
      const target = e.target as HTMLElement;
      const isDocumentContent = (
        target.tagName === 'IFRAME' ||
        target.closest('iframe') ||
        target.classList.contains('react-pdf__Page') ||
        !!target.closest('.react-pdf__Page') ||
        target.classList.contains('document-viewer-area') ||
        !!target.closest('.document-viewer-area')
      );
      
      if (!isDocumentContent) {
        console.log('Selection outside document content - ignored');
      }
    };
    
    document.addEventListener('mousedown', preventDocumentSelection);
    return () => document.removeEventListener('mousedown', preventDocumentSelection);
  }, [presentationData, onTextSelect]);

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!Object.keys(SUPPORTED_FILE_TYPES).includes(fileExt)) {
      setUploadError(`Please select a supported file type (${Object.values(SUPPORTED_FILE_TYPES).join(', ')})`);
      return;
    }

    try {
      setIsUploading(true);
      setIsLoading(true);
      setUploadProgress(0);
      setUploadError(null);
      setUploadStage('uploading');
      setUploadMessage('Uploading file...');

      // Start progress simulation
      const progressTimer = setInterval(() => {
        setUploadProgress(prev => {
          const nextProgress = prev + 1;
          return nextProgress >= 95 ? 95 : nextProgress; // Cap at 95% until actual completion
        });
      }, 100);

      const formData = new FormData();
      formData.append('file', file);

      const apiUrl = process.env.VITE_PRODUCTION_API_URL || 'https://clarity-backend-production.up.railway.app';
      const response = await fetch(`${apiUrl}/api/presentations/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          'Origin': window.location.origin
        },
        mode: 'cors'
      });

      // Clear the progress simulation timer
      clearInterval(progressTimer);

      if (!response.ok) {
        throw new Error(`Upload failed: ${await response.text()}`);
      }

      const responseData = await response.json();

      if (!responseData.document_id) {
        throw new Error('No document ID received from server');
      }

      await setupPowerPointViewing(responseData);

    } catch (err) {
      console.error('Upload error:', err);
      setUploadError(err instanceof Error ? err.message : 'Failed to upload file. Please try again.');
      setIsUploading(false);
      setIsLoading(false);
      setUploadStage('idle');
      setUploadProgress(0); // Reset progress on error
    }
  };

  // Setup PowerPoint viewing
  const setupPowerPointViewing = async (fileData: FileStatusResponse) => {
    try {
      setUploadStage('converting');
      setUploadMessage('Preparing document for viewing...');
      
      if (fileData.status === 'ready' && fileData.file_url) {
        const fileUrl = fileData.file_url;
        
        // Determine file type from filename or content type
        const filename = fileData.filename?.toLowerCase() || '';
        const isPDF = filename.endsWith('.pdf');
        const isPowerPoint = filename.endsWith('.ppt') || filename.endsWith('.pptx');
        const isWord = filename.endsWith('.doc') || filename.endsWith('.docx');
        
        console.log('PresentationViewer: File type detection:', {
          filename,
          isPDF,
          isPowerPoint,
          isWord
        });
        
        setPresentationData({
          id: fileData.document_id,
          document_id: fileData.document_id,
          status: 'ready',
          url: fileUrl,
          filename: fileData.filename || 'document',
          type: isPDF ? 'pdf' : isPowerPoint ? 'powerpoint' : isWord ? 'word' : 'pdf', // Default to PDF if unknown
          apiUrl: fileUrl,
          isPowerPoint,
          isWord
        });
        
        setIsUploading(false);
        setIsLoading(false);
        setUploadProgress(100);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error setting up document viewing:', error);
      setUploadError((error as Error).message || 'Error setting up document viewing');
      setIsLoading(false);
      setIsUploading(false);
      return false;
    }
  };

  // Handle text selection
  const handleTextSelection = (text: string) => {
    if (text && onTextSelect) {
      const cleanText = cleanSelectedText(text);
      if (cleanText) {
        onTextSelect(cleanText);
      }
    }
  };
  
  // Reset presentation
  const resetPresentation = () => {
    setPresentationData(null);
    setUploadProgress(0);
    setIsLoading(false);
    setIsUploading(false);
    setUploadError(null);
    setUploadStage('idle');
    setUploadMessage('Uploading file...');
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    onReset?.();
  };

  // Expose resetPresentation method
  useImperativeHandle(ref, () => ({
    resetPresentation
  }));

  return (
    <div className="w-full h-full flex flex-col transform-gpu backface-visibility-hidden">
      {/* File Upload UI */}
      {!presentationData ? (
        <label 
          htmlFor="file-upload"
          className="upload-area"
        >
          {uploadError ? (
            <div className="text-red-500 text-xl mb-4">{uploadError}</div>
          ) : isUploading || isLoading ? (
            <div className="flex flex-col items-center justify-center w-full max-w-md">
              <div className="animate-spin rounded-full h-16 w-16 border-t-3 border-b-3 border-blue-500 mb-6"></div>
              <p className="text-gray-600 text-lg mb-4">{uploadMessage}</p>
              
              {/* Processing stage indicator */}
              <div className="flex items-center gap-2 mb-4">
                <div className={`h-2 w-2 rounded-full ${uploadStage === 'uploading' ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                <div className={`h-2 w-2 rounded-full ${uploadStage === 'processing' ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                <div className={`h-2 w-2 rounded-full ${uploadStage === 'converting' ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
              </div>
              
              {/* Progress bar */}
              <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 transition-all duration-150 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              
              {/* Progress percentage */}
              <p className="text-sm text-gray-600 mt-2">
                {Math.round(uploadProgress)}% Complete
              </p>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
                <Upload className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-center">
                <p className="text-xl font-medium text-gray-900 mb-2">
                  Upload Document
                </p>
                <p className="text-base text-gray-500">
                  Drag and drop your file here, or click to browse
                </p>
              </div>
            </div>
          )}
          <input
            id="file-upload" 
            type="file"
            accept=".ppt,.pptx,.doc,.docx,.pdf"
            className="hidden"
            onChange={handleFileUpload}
            ref={fileInputRef}
            disabled={isLoading}
          />
        </label>
      ) : (
        <div className="flex flex-col flex-grow h-full">
          {/* Document viewer */}
          <div className="flex-grow h-full w-full document-viewer-area relative">
            {presentationData.type === 'pdf' ? (
              <PDFViewer 
                url={presentationData.url} 
                apiUrl={presentationData.apiUrl}
                filename={presentationData.filename}
                onTextSelect={handlePDFTextSelection}
                onDocumentTextExtracted={onDocumentTextExtracted}
                defaultZoom={0.7}
              />
            ) : presentationData.type === 'powerpoint' ? (
              <PowerPointViewer 
                url={presentationData.url} 
                onTextSelect={handleTextSelection}
                onDocumentTextExtracted={onDocumentTextExtracted}
              />
            ) : presentationData.type === 'word' ? (
              <WordViewer 
                url={presentationData.url} 
                apiUrl={presentationData.apiUrl}
                filename={presentationData.filename}
                onTextSelect={handleTextSelection}
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center p-4">
                  <p className="text-red-500 mb-2">Unsupported file type</p>
                  <button 
                    onClick={resetPresentation}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Upload a different file
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Error message display */}
      {uploadError && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-md max-w-[90%] md:max-w-md z-50">
          <p>{uploadError}</p>
          <button 
            className="absolute top-0 right-0 p-2" 
            onClick={() => setUploadError(null)}
          >
            <span className="text-red-500">&times;</span>
          </button>
        </div>
      )}
    </div>
  );
});

<style dangerouslySetInnerHTML={{
  __html: `
    .upload-area {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 0;
      background: white;
      border: 2px dashed #e5e7eb;
      border-radius: 0.5rem;
      margin: 1rem;
      transition: all 0.3s ease;
      min-height: calc(100vh - 180px);
      width: calc(100% - 2rem);
      cursor: pointer;
      position: relative;
    }

    .upload-area:hover {
      border-color: #60A5FA;
      background-color: #F8FAFC;
    }

    .upload-area:active {
      border-color: #3B82F6;
      background-color: #F1F5F9;
    }

    @media (max-width: 768px) {
      .upload-area {
        min-height: 200px;
        margin: 0;
        width: 100%;
        border: 2px dashed #e5e7eb;
      }
    }
  `
}} />
