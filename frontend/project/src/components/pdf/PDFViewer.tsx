import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { ZoomIn, ZoomOut, ArrowUp } from 'lucide-react';

// Configure PDF.js to use the worker from public directory
// The worker has been copied from node_modules/pdfjs-dist/build/pdf.worker.min.mjs
pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.js`;

console.log('PDF Viewer: Using worker file from public directory (v4.8.69)');

export type PDFViewerProps = {
  url: string;
  apiUrl?: string;
  filename: string;
  onTextSelect?: (text: string, extractedText?: string) => void;
  onDocumentTextExtracted?: (text: string | null) => void;
  defaultZoom?: number;
};

export const PDFViewer: React.FC<PDFViewerProps> = ({ 
  url, 
  apiUrl, 
  onTextSelect,
  onDocumentTextExtracted,
  defaultZoom = 1
}) => {
  // PDF viewer states
  const [numPages, setNumPages] = useState<number | null>(null);
  const [scale, setScale] = useState<number>(defaultZoom);
  const [zoomLevel, setZoomLevel] = useState<number>(defaultZoom);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fallbackToIframe, setFallbackToIframe] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [showScrollToTop, setShowScrollToTop] = useState<boolean>(false);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  
  // Always prefer the direct PDF URL for better text selection
  const pdfUrl = apiUrl || url;

  // Update scale when defaultZoom changes
  useEffect(() => {
    setScale(defaultZoom);
    setZoomLevel(defaultZoom);
  }, [defaultZoom]);

  // Handle scroll to top visibility
  useEffect(() => {
    const handleScroll = () => {
      if (viewerContainerRef.current) {
        setShowScrollToTop(viewerContainerRef.current.scrollTop > 200);
      }
    };

    const container = viewerContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  // Extract text from PDF document
  const extractTextFromPdf = async (pdf: pdfjs.PDFDocumentProxy) => {
    try {
      console.log('Extracting text from PDF document...');
      const textItems: string[] = [];
      
      // Process each page
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((item: any) => item.str)
          .join(' ');
        textItems.push(pageText);
      }
      
      // Combine all text
      const fullText = textItems.join('\n\n');
      console.log(`Extracted ${fullText.length} characters of text from PDF`);
      
      // Send text to parent component if handler exists
      if (onDocumentTextExtracted) {
        onDocumentTextExtracted(fullText);
      }
      
      return fullText;
    } catch (err) {
      console.error('Error extracting text from PDF:', err);
      if (onDocumentTextExtracted) {
        onDocumentTextExtracted(null);
      }
      return null;
    }
  };

  // Add custom styles for text selection and debugging
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      /* Enhanced text layer styles for better selection */
      .react-pdf__Page__textContent {
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        transform: none !important;
        line-height: 1.6 !important;
        pointer-events: none;
        user-select: text !important;
        overflow: visible !important;
        position: absolute !important;
        z-index: 2 !important;
      }
      
      /* Text spans (line containers) */
      .react-pdf__Page__textContent > span {
        position: absolute !important;
        color: transparent !important;
        transform-origin: 0% 0% !important;
        white-space: pre !important;
        cursor: text !important;
        transform: none !important;
        display: block !important;
        min-height: 1.2em !important;
        pointer-events: auto !important;
        user-select: text !important;
        /* Fix size constraints that cause cutoff */
        width: auto !important;
        height: auto !important;
        min-width: 1em !important;
        /* Debug border - uncomment to see text boundaries */
        /* outline: 1px solid rgba(255, 0, 0, 0.1) !important; */
      }
      
      /* Help users see where text is selectable with hover effect */
      .react-pdf__Page__textContent > span:hover {
        background-color: rgba(59, 130, 246, 0.1) !important;
        border-radius: 2px !important;
        /* Debug outline - shows exact text boundaries on hover */
        outline: 1px dashed rgba(255, 0, 0, 0.5) !important;
      }
      
      /* Selection styling */
      .react-pdf__Page__textContent > span::selection,
      .react-pdf__Page__textContent > span > span::selection {
        background: rgba(59, 130, 246, 0.3) !important;
        color: transparent !important;
      }
      
      /* Fix page positioning */
      .react-pdf__Page {
        position: relative !important;
        overflow: visible !important;
        margin-bottom: 1rem !important;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24) !important;
      }
      
      /* Ensure canvas is below text for selection */
      .react-pdf__Page__canvas {
        z-index: 1 !important;
      }
      
      /* Debug toggle button */
      .debug-button {
        position: fixed;
        bottom: 16px;
        left: 16px;
        background-color: rgba(255, 255, 255, 0.8);
        border: 1px solid #ccc;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 12px;
        cursor: pointer;
        z-index: 9999;
      }
      
      /* Debug mode styles */
      .debug-mode .react-pdf__Page__textContent > span {
        outline: 1px solid rgba(255, 0, 0, 0.3) !important;
        background-color: rgba(255, 255, 0, 0.05) !important;
      }
      
      .debug-mode .react-pdf__Page__textContent > span > span {
        outline: 1px dotted rgba(0, 0, 255, 0.3) !important;
        background-color: rgba(0, 255, 255, 0.05) !important;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Add debug mode state
  const [debugMode, setDebugMode] = useState(false);
  
  // Toggle debug mode
  const toggleDebugMode = () => {
    setDebugMode(!debugMode);
    if (containerRef.current) {
      containerRef.current.classList.toggle('debug-mode');
    }
  };
  
  // Log text layer positions for debugging
  const logTextLayerInfo = (pageNumber: number) => {
    if (!debugMode) return;
    
    setTimeout(() => {
      // Find text spans
      const textLayer = document.querySelector(`.react-pdf__Page[data-page-number="${pageNumber}"] .react-pdf__Page__textContent`);
      const spans = textLayer?.querySelectorAll('span');
      
      if (spans && spans.length > 0) {
        console.log(`Page ${pageNumber} has ${spans.length} text spans`);
        
        // Find spans near bottom of page
        const pageHeight = (textLayer as HTMLElement)?.offsetHeight || 0;
        let bottomSpans = 0;
        let cutoffSpans = 0;
        
        spans.forEach((span, index) => {
          const spanBottom = (span as HTMLElement).offsetTop + (span as HTMLElement).offsetHeight;
          
          // Check if span is near bottom of page
          if (pageHeight - spanBottom < 50) {
            bottomSpans++;
            console.log(`  Bottom span ${index}: `, {
              text: span.textContent?.slice(0, 20),
              top: (span as HTMLElement).offsetTop,
              height: (span as HTMLElement).offsetHeight,
              bottom: spanBottom,
              pageHeight,
              distanceFromBottom: pageHeight - spanBottom
            });
          }
          
          // Check if span might be cutoff
          if (spanBottom > pageHeight) {
            cutoffSpans++;
            console.log(`  ⚠️ CUTOFF span ${index}: `, {
              text: span.textContent?.slice(0, 20),
              offsetTop: (span as HTMLElement).offsetTop,
              height: (span as HTMLElement).offsetHeight,
              bottom: spanBottom,
              pageHeight,
              overflow: spanBottom - pageHeight
            });
          }
        });
        
        console.log(`Page ${pageNumber} summary: ${bottomSpans} spans near bottom, ${cutoffSpans} potentially cutoff spans`);
      }
    }, 500); // Delay to ensure text layer is rendered
  };

  // Add event listener to preserve selection when clicking in chat area
  useEffect(() => {
    const handleChatInteraction = (e: MouseEvent) => {
      // Don't interfere with input elements or the chat area
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, .chat-input-area')) {
        return;
      }

      // Only clear selection if clicking outside text layers and input areas
      if (!target.closest('.react-pdf__Page__textContent')) {
        window.getSelection()?.removeAllRanges();
      }
    };

    // Add the event listener in the capture phase
    document.addEventListener('mousedown', handleChatInteraction, true);
    document.addEventListener('click', handleChatInteraction, true);
    
    return () => {
      document.removeEventListener('mousedown', handleChatInteraction, true);
      document.removeEventListener('click', handleChatInteraction, true);
    };
  }, []);

  const handleZoomChange = (newZoom: number) => {
    setZoomLevel(newZoom);
    setScale(newZoom);
  };

  const analyzePDF = async (pdf: pdfjs.PDFDocumentProxy) => {
    try {
      const text = await extractTextFromPdf(pdf);
      return text;
    } catch (error) {
      console.error('Error analyzing PDF:', error);
      return null;
    }
  };

  const onDocumentLoadSuccess = async (pdf: pdfjs.PDFDocumentProxy) => {
    console.log(`PDF loaded with ${pdf.numPages} pages`);
    setNumPages(pdf.numPages);
    setIsLoading(false);
    setPdfError(null);
    
    // Run PDF analysis if in debug mode
    if (debugMode) {
      await analyzePDF(pdf);
    }
    
    // Extract text if needed
    if (onDocumentTextExtracted) {
      extractTextFromPdf(pdf);
    }
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('PDF Viewer: Error loading PDF:', error);
    setPdfError(error.message);
    setIsLoading(false);
    
    if (onDocumentTextExtracted) {
      onDocumentTextExtracted(null);
    }
    
    // Check for version mismatch error
    if (error.message.includes('version') || error.message.includes('worker')) {
      console.warn('PDF Viewer: Version mismatch detected, falling back to iframe viewer');
      setFallbackToIframe(true);
    }
  };

  return (
    <div className="flex flex-col h-full w-full transform-gpu backface-visibility-hidden" ref={containerRef}>
      {/* Error message */}
      {pdfError && (
        <div className="bg-yellow-100 text-yellow-800 p-2 rounded mb-2 mx-4">
          {pdfError}
          <div className="mt-1">
            {!fallbackToIframe ? (
              <button 
                onClick={() => setFallbackToIframe(true)} 
                className="underline text-blue-600 hover:text-blue-800 mr-2"
              >
                Try Alternate Viewer
              </button>
            ) : (
              <button 
                onClick={() => window.location.reload()} 
                className="underline text-blue-600 hover:text-blue-800"
              >
                Reload Page
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* PDF Controls */}
      {!pdfError && !isLoading && numPages && !fallbackToIframe && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-blue-800 text-sm flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span>All {numPages} pages displayed</span>
          </div>
          <div className="flex items-center">
            <button 
              onClick={() => handleZoomChange(Math.max(0.5, zoomLevel - 0.1))} 
              className="p-1 rounded text-blue-600 hover:bg-blue-100"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="mx-2 text-sm">{Math.round(scale * 100)}%</span>
            <button 
              onClick={() => handleZoomChange(Math.min(3, zoomLevel + 0.1))} 
              className="p-1 rounded text-blue-600 hover:bg-blue-100"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-10">
          <div className="animate-spin rounded-full h-16 w-16 border-t-3 border-b-3 border-blue-500 mb-4"></div>
          <p className="text-gray-600 text-lg mb-2">Loading PDF document...</p>
          <p className="text-sm text-gray-500">This may take a moment for large files</p>
        </div>
      )}
      
      {/* PDF Viewer */}
      <div className="flex-grow h-full w-full overflow-auto pdf-viewer-container" ref={viewerContainerRef}>
        {!fallbackToIframe ? (
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={<div className="w-full h-full flex items-center justify-center">Loading PDF...</div>}
            error={<div className="w-full h-full flex items-center justify-center text-red-500">Could not load PDF.</div>}
            className="flex flex-col items-center pb-4"
          >
            {numPages && (
              <>
                {/* Render all pages */}
                {Array.from(new Array(numPages), (_, index) => (
                  <div key={`page_${index + 1}`} className="mb-4">
                    <Page
                      key={`page_${index + 1}`}
                      pageNumber={index + 1}
                      scale={scale}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                      className="shadow-md mt-4"
                      onLoadSuccess={() => {
                        console.log(`Page ${index + 1} loaded successfully`);
                        logTextLayerInfo(index + 1);
                      }}
                      onRenderSuccess={() => {
                        console.log(`Page ${index + 1} rendered successfully`);
                        logTextLayerInfo(index + 1);
                      }}
                      onGetTextSuccess={() => {
                        if (onTextSelect) {
                          console.log(`Text layer for page ${index + 1} extracted successfully`);
                        }
                      }}
                    />
                  </div>
                ))}
              </>
            )}
          </Document>
        ) : (
          <iframe
            ref={iframeRef}
            src={pdfUrl}
            className="w-full h-full border-0"
            title="PDF Viewer (Fallback)"
            sandbox="allow-scripts allow-same-origin"
            onLoad={() => setIsLoading(false)}
          />
        )}
      </div>
      
      {/* Scroll to top button */}
      {showScrollToTop && (
        <button
          onClick={() => viewerContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 bg-blue-600 text-white p-2 rounded-full shadow-md hover:bg-blue-700 focus:outline-none"
          aria-label="Scroll to top"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}

      {/* Debug button */}
      <button
        onClick={toggleDebugMode}
        className="debug-button"
        title="Toggle debug mode"
      >
        {debugMode ? 'Disable Debug' : 'Enable Debug'}
      </button>
    </div>
  );
};

export default PDFViewer; 