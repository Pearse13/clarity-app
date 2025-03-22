import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from 'lucide-react';

// Initialize PDF.js worker with explicit version
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.js`;

export type PDFViewerProps = {
  url: string;
  apiUrl?: string;
  filename: string;
};

export const PDFViewer: React.FC<PDFViewerProps> = ({ url, apiUrl, filename }) => {
  // PDF viewer states
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [viewerAttempt, setViewerAttempt] = useState<number>(1);
  const [useFallbackViewer, setUseFallbackViewer] = useState<boolean>(false);
  
  // Use the direct PDF URL if available, otherwise use the Google Drive URL
  const pdfUrl = apiUrl || url;
  
  // Log the URLs for debugging
  useEffect(() => {
    console.log('PDFViewer mounted with URLs:', { 
      googleUrl: url, 
      directUrl: apiUrl,
      usingUrl: pdfUrl 
    });
    
    // Attempt to determine if we should use the direct PDF URL or fallback to Google Drive
    const checkPdfAccess = async () => {
      if (apiUrl) {
        try {
          const response = await fetch(apiUrl, { method: 'HEAD' });
          if (response.ok) {
            console.log('Direct PDF URL is accessible, using it as primary source');
          } else {
            console.log('Direct PDF URL returned status:', response.status);
            setUseFallbackViewer(true);
          }
        } catch (err) {
          console.error('Error checking PDF URL access:', err);
          setUseFallbackViewer(true);
        }
      }
    };
    
    checkPdfAccess();
  }, [url, apiUrl, pdfUrl]);

  // Functions for PDF navigation
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
    setPdfError(null);
    setIsLoading(false);
    console.log('PDF document loaded successfully. Pages:', numPages);
  };

  const changePage = (offset: number) => {
    if (!numPages) return;
    const newPage = pageNumber + offset;
    if (newPage >= 1 && newPage <= numPages) {
      setPageNumber(newPage);
    }
  };

  const previousPage = () => changePage(-1);
  const nextPage = () => changePage(1);

  const zoomIn = () => setScale(prev => Math.min(prev + 0.1, 2.0));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.1, 0.5));

  const onDocumentLoadError = (error: Error) => {
    console.error('Error loading PDF:', error);
    
    if (viewerAttempt === 1) {
      setPdfError('Switching to direct iframe viewer...');
      setViewerAttempt(2);
      // Skip Google Drive and go directly to iframe fallback
      setUseFallbackViewer(true);
    } else {
      setPdfError('PDF viewing failed. Please try again.');
      setIsLoading(false);
    }
  };

  // Clean up blob URLs when component unmounts
  useEffect(() => {
    return () => {
      if (url && url.startsWith('blob:')) {
        console.log('Revoking blob URL:', url);
        URL.revokeObjectURL(url);
      }
    };
  }, [url]);

  // Check if the URL is a Google Drive viewer URL
  const isGoogleDriveViewer = url.includes('docs.google.com/viewer');

  return (
    <div className="w-full h-full min-h-[600px] relative flex flex-col">
      {/* Navigation controls for non-Google Drive viewer */}
      {!isGoogleDriveViewer && !useFallbackViewer && (
        <div className="flex items-center justify-between mb-2 p-2 bg-gray-100 rounded">
          <div className="flex items-center space-x-2">
            <button 
              onClick={previousPage} 
              disabled={pageNumber <= 1}
              className={`p-1 rounded ${pageNumber <= 1 ? 'text-gray-400' : 'text-gray-700 hover:bg-gray-200'}`}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm">
              Page {pageNumber} of {numPages || '?'}
            </span>
            <button 
              onClick={nextPage} 
              disabled={pageNumber >= (numPages || 1)}
              className={`p-1 rounded ${pageNumber >= (numPages || 1) ? 'text-gray-400' : 'text-gray-700 hover:bg-gray-200'}`}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={zoomOut} className="p-1 rounded text-gray-700 hover:bg-gray-200">
              <ZoomOut className="w-5 h-5" />
            </button>
            <span className="text-sm">{Math.round(scale * 100)}%</span>
            <button onClick={zoomIn} className="p-1 rounded text-gray-700 hover:bg-gray-200">
              <ZoomIn className="w-5 h-5" />
            </button>
            {apiUrl && (
              <a 
                href={apiUrl}
                target="_blank" 
                rel="noopener noreferrer"
                className="ml-4 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Open in New Tab
              </a>
            )}
          </div>
        </div>
      )}
      
      {/* Google Drive viewer or notification for it */}
      {isGoogleDriveViewer && (
        <div className="p-2 bg-yellow-100 text-yellow-800 mb-2 rounded text-sm">
          Using Google Drive viewer for compatibility.
        </div>
      )}
      
      {/* Main content area */}
      <div className="flex-grow overflow-auto flex justify-center bg-gray-100 rounded">
        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            <p className="mt-4 text-gray-600">Loading PDF document...</p>
          </div>
        )}
        
        {/* Error messaging */}
        {pdfError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10">
            <p className="text-red-500 mb-4">{pdfError}</p>
            <button
              onClick={() => {
                setPdfError(null);
                setIsLoading(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        )}
        
        {/* Different viewing options based on state */}
        {isGoogleDriveViewer ? (
          // Google Drive viewer
          <iframe
            src={url}
            className="w-full h-full border-none flex-grow"
            sandbox="allow-scripts allow-same-origin allow-forms"
            referrerPolicy="no-referrer"
            title="PDF Document (Google Drive)"
            onLoad={() => {
              console.log('Google Drive PDF viewer loaded successfully');
              setIsLoading(false);
            }}
            onError={() => {
              console.error('Google Drive PDF viewer failed to load');
              setPdfError('Could not load PDF. Please try downloading it directly.');
              setUseFallbackViewer(true);
              setIsLoading(false);
            }}
          />
        ) : !useFallbackViewer ? (
          // PDF.js viewer
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex flex-col items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                <p className="mt-2 text-gray-600">Loading PDF document...</p>
                <p className="text-sm text-gray-500 mb-4">Large documents may take longer to load</p>
                {apiUrl && (
                  <a 
                    href={apiUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF directly
                  </a>
                )}
              </div>
            }
            error={
              <div className="flex flex-col items-center justify-center h-full">
                <p className="text-red-500 mb-2">Failed to load PDF document.</p>
                {apiUrl && (
                  <a 
                    href={apiUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF directly
                  </a>
                )}
              </div>
            }
          >
            <Page 
              pageNumber={pageNumber} 
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="shadow-lg mx-auto"
              loading={
                <div className="flex justify-center items-center h-[600px]">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              }
            />
          </Document>
        ) : (
          // Fallback direct iframe 
          <div className="w-full h-full flex flex-col">
            <div className="p-2 bg-yellow-100 text-yellow-800 mb-2 rounded text-sm">
              Using fallback viewer for compatibility. Some features may be limited.
            </div>
            {url && url.includes('docs.google.com') ? (
              // Use Google Drive viewer if available
              <iframe
                src={url}
                className="w-full h-full border-none flex-grow"
                sandbox="allow-scripts allow-same-origin allow-forms"
                referrerPolicy="no-referrer"
                title="PDF Document (Google Drive)"
                onLoad={() => {
                  console.log('Google Drive PDF viewer loaded successfully');
                  setIsLoading(false);
                }}
                onError={() => {
                  console.error('Google Drive PDF viewer failed to load');
                  setPdfError('All PDF viewing methods failed. Please download the file directly.');
                  setIsLoading(false);
                }}
              />
            ) : (
              // Direct PDF iframe
              <iframe 
                src={apiUrl || url}
                className="w-full h-full border-none flex-grow" 
                title="PDF Document"
                onLoad={() => {
                  console.log('Direct PDF iframe loaded successfully');
                  setIsLoading(false);
                }}
                onError={() => {
                  console.error('Direct PDF iframe failed to load');
                  setPdfError('All PDF viewing methods failed. Please try again later.');
                  setIsLoading(false);
                }}
              />
            )}
            
            {apiUrl && (
              <div className="p-2">
                <a 
                  href={apiUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF directly
                </a>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Download button for all viewers */}
      <div className="mt-2 flex justify-end">
        {apiUrl && (
          <a 
            href={apiUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 flex items-center"
            download={filename}
          >
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </a>
        )}
      </div>
    </div>
  );
}; 