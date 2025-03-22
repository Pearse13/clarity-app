import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from 'lucide-react';

// Initialize PDF.js worker with a known working URL
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js`;

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
  const [iframeLoaded, setIframeLoaded] = useState<boolean>(false);
  
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

  // When iframe loads successfully, clear any error messages
  useEffect(() => {
    if (iframeLoaded && useFallbackViewer) {
      // Clear error message when iframe loads successfully
      setPdfError(null);
      setIsLoading(false);
    }
  }, [iframeLoaded, useFallbackViewer]);

  // Check if the URL is a Google Drive viewer URL
  const isGoogleDriveViewer = url.includes('docs.google.com/viewer');

  return (
    <div className="flex flex-col h-full">
      {/* Error message */}
      {pdfError && !iframeLoaded && (
        <div className="bg-yellow-100 text-yellow-800 p-2 rounded mb-2">
          {pdfError}
          {useFallbackViewer && !iframeLoaded && (
            <div className="mt-1">
              <button 
                onClick={() => window.location.reload()} 
                className="underline text-blue-600 hover:text-blue-800"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Loading indicator */}
      {isLoading && !iframeLoaded && (
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          <span className="ml-2">Loading document...</span>
        </div>
      )}
      
      {/* PDF Viewer */}
      <div className="flex-grow relative">
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
              setIframeLoaded(true);
            }}
            onError={() => {
              console.error('Google Drive PDF viewer failed to load');
              setPdfError('Could not load PDF. Please try downloading it directly.');
              setUseFallbackViewer(true);
              setIsLoading(false);
            }}
          />
        ) : !useFallbackViewer ?
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
              </div>
            }
            className="h-full flex justify-center"
            error={
              <div className="flex flex-col items-center justify-center h-full">
                <p className="text-red-500">Failed to load PDF</p>
                <button 
                  onClick={() => setViewerAttempt(prev => prev + 1)}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Retry
                </button>
              </div>
            }
          >
            {numPages && (
              <div className="flex flex-col items-center justify-center">
                <div className="flex items-center justify-center mb-2">
                  <button 
                    onClick={previousPage} 
                    disabled={pageNumber <= 1}
                    className={`p-2 rounded ${pageNumber <= 1 ? 'text-gray-400' : 'text-blue-600 hover:bg-blue-100'}`}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="mx-2 text-sm">Page {pageNumber} of {numPages}</span>
                  <button 
                    onClick={nextPage} 
                    disabled={pageNumber >= numPages}
                    className={`p-2 rounded ${pageNumber >= numPages ? 'text-gray-400' : 'text-blue-600 hover:bg-blue-100'}`}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex items-center justify-center mb-2">
                  <button 
                    onClick={zoomOut} 
                    className="p-2 rounded text-blue-600 hover:bg-blue-100"
                  >
                    <ZoomOut className="w-5 h-5" />
                  </button>
                  <span className="mx-2 text-sm">{Math.round(scale * 100)}%</span>
                  <button 
                    onClick={zoomIn} 
                    className="p-2 rounded text-blue-600 hover:bg-blue-100"
                  >
                    <ZoomIn className="w-5 h-5" />
                  </button>
                </div>
                <Page 
                  pageNumber={pageNumber} 
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  className="border"
                />
              </div>
            )}
          </Document>
        : (
          // Fallback direct iframe 
          <div className="w-full h-full flex flex-col">
            {pdfError && !iframeLoaded && (
              <div className="p-2 bg-yellow-100 text-yellow-800 mb-2 rounded text-sm">
                Loading document in fallback viewer...
              </div>
            )}
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
                  setIframeLoaded(true);
                  setPdfError(null);
                }}
                onError={() => {
                  console.error('Google Drive PDF viewer failed to load');
                  setPdfError('All PDF viewing methods failed. Please try again later.');
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
                  setIframeLoaded(true);
                  setPdfError(null);
                }}
                onError={() => {
                  console.error('Direct PDF iframe failed to load');
                  setPdfError('All PDF viewing methods failed. Please try again later.');
                  setIsLoading(false);
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}; 