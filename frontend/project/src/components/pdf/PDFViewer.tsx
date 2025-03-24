import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { ZoomIn, ZoomOut, ArrowUp } from 'lucide-react';

// Set worker directly to the public path
pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.js`;

// No need for fallback now since we've copied the worker to public
console.log('PDF Viewer: Using PDF worker version 4.8.69 from public directory');

export type PDFViewerProps = {
  url: string;
  apiUrl?: string;
  filename: string;
  onTextSelect?: (text: string, extractedText?: string) => void;
  onDocumentTextExtracted?: (text: string | null) => void;
};

export const PDFViewer: React.FC<PDFViewerProps> = ({ 
  url, 
  apiUrl, 
  onTextSelect,
  onDocumentTextExtracted 
}) => {
  // PDF viewer states
  const [numPages, setNumPages] = useState<number | null>(null);
  const [scale, setScale] = useState<number>(1);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fallbackToIframe, setFallbackToIframe] = useState<boolean>(false);
  const [documentText, setDocumentText] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isMouseDownInIframe, setIsMouseDownInIframe] = useState<boolean>(false);
  const [showScrollToTop, setShowScrollToTop] = useState<boolean>(false);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  
  // Always prefer the direct PDF URL for better text selection
  const pdfUrl = apiUrl || url;

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
      
      setDocumentText(fullText);
      
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

  // Handle text selection from the PDF
  const handleTextSelection = () => {
    if (!onTextSelect) return;
    
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    
    console.log('PDF Viewer: Selection event triggered, raw text:', text);
    
    if (text) {
      console.log('PDF Viewer: Text selected, sending to parent:', text);
      onTextSelect(text, documentText || undefined);
    }
  };
  
  // Handle successful PDF document load
  const onDocumentLoadSuccess = (pdf: pdfjs.PDFDocumentProxy) => {
    console.log('PDF Viewer: Document loaded successfully with', pdf.numPages, 'pages');
    setNumPages(pdf.numPages);
    setIsLoading(false);
    setPdfError(null);

    // Extract text from the PDF document
    extractTextFromPdf(pdf);

    // Add a delay to allow the text layers to render fully
    setTimeout(() => {
      if (containerRef.current) {
        // Find all text layers in the document
        const textLayers = containerRef.current.querySelectorAll('.react-pdf__Page__textContent');
        console.log('PDF Viewer: Found', textLayers.length, 'text layers');
        
        // Add selection listeners to each layer
        textLayers.forEach((layer, index) => {
          layer.addEventListener('mouseup', handleTextSelection);
          (layer as HTMLElement).style.userSelect = 'text';
          (layer as HTMLElement).style.cursor = 'text';
          console.log(`PDF Viewer: Added listener to text layer ${index+1}`);
        });
      }
    }, 1000);
  };
  
  // Handle PDF document load error
  const onDocumentLoadError = (error: Error) => {
    console.error('PDF Viewer: Error loading PDF:', error);
    
    // Check if it's a version mismatch error
    if (error.message && error.message.includes('version')) {
      console.log('PDF Viewer: Version mismatch detected, falling back to iframe viewer');
      setPdfError('PDF.js version mismatch detected. Using alternative viewer.');
    } else {
      setPdfError(`Error loading PDF: ${error.message}`);
    }
    
    setIsLoading(false);
    
    // Fall back to iframe if react-pdf fails
    setFallbackToIframe(true);
  };
  
  // Set up iframe mouse tracking to detect selections
  useEffect(() => {
    if (!onTextSelect || !containerRef.current) return;
    
    const container = containerRef.current;
    
    // Track mouse down to detect if user is selecting text
    const handleMouseDown = (e: MouseEvent) => {
      // Check if the target is the iframe or within the iframe container
      const isIframeOrContainer = 
        e.target === iframeRef.current || 
        container.contains(e.target as Node);
      
      if (isIframeOrContainer) {
        setIsMouseDownInIframe(true);
        console.log('PDF Viewer: Mouse down in iframe area');
      } else {
        setIsMouseDownInIframe(false);
      }
    };
    
    // Handle mouseup to check for selections
    const handleMouseUp = () => {
      if (isMouseDownInIframe) {
        console.log('PDF Viewer: Mouse up after mousedown in iframe');
        
        // Give time for selection to complete
        setTimeout(() => {
          const selection = window.getSelection();
          const selectedText = selection?.toString().trim();
          
          if (selectedText) {
            console.log('PDF Viewer: Text selected after iframe interaction:', selectedText);
            onTextSelect(selectedText, documentText || undefined);
          }
        }, 100);
      }
      
      setIsMouseDownInIframe(false);
    };
    
    // Handle selection change to capture text
    const handleSelectionChange = () => {
      if (isMouseDownInIframe) {
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim();
        
        if (selectedText) {
          console.log('PDF Viewer: Selection changed with text:', selectedText);
          // We don't call onTextSelect here to avoid duplicate events
          // The mouseup handler will handle the final selection
        }
      }
    };
    
    // Add the event listeners
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('selectionchange', handleSelectionChange);
    
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [isMouseDownInIframe, onTextSelect, documentText]);
  
  // Handle iframe events for fallback mode
  const handleIframeLoad = () => {
    console.log('PDF Viewer: Iframe loaded successfully');
    setIsLoading(false);
  };

  // Fall back to iframe if react-pdf fails
  const renderFallbackIframe = () => {
    return (
      <div className="w-full h-full">
        <iframe 
          ref={iframeRef}
          src={pdfUrl}
          className="w-full h-full border-none" 
          title="PDF Document"
          onLoad={handleIframeLoad}
          // Add additional properties to improve accessibility
          sandbox="allow-same-origin allow-scripts"
          style={{ pointerEvents: 'auto' }}
          onError={() => {
            console.error('PDF Viewer: Iframe failed to load');
            setPdfError('Failed to load PDF in both viewers. Please check the file format or try a different file.');
            setIsLoading(false);
          }}
        />
      </div>
    );
  };
  
  // Clean up blob URLs when component unmounts
  useEffect(() => {
    return () => {
      if (url && url.startsWith('blob:')) {
        console.log('PDF Viewer: Revoking blob URL:', url);
        URL.revokeObjectURL(url);
      }
    };
  }, [url]);
  
  // Zoom functions
  const zoomIn = () => {
    setScale(prevScale => Math.min(prevScale + 0.1, 2.5));
  };
  
  const zoomOut = () => {
    setScale(prevScale => Math.max(prevScale - 0.1, 0.5));
  };
  
  // When the component mounts, update the document-level event listeners
  useEffect(() => {
    console.log('PDF Viewer: Mounted with PDF URL:', pdfUrl);
    
    // Set up a document-level selection handler to capture all text selections
    const handleDocumentSelection = () => {
      if (!onTextSelect) return;
      
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim();
      
      if (selectedText) {
        console.log('PDF Viewer: Document-level text selection detected:', selectedText);
        onTextSelect(selectedText, documentText || undefined);
      }
    };
    
    // Add selection change handler at document level (this works even with iframe content if from same origin)
    document.addEventListener('selectionchange', handleDocumentSelection);
    
    return () => {
      document.removeEventListener('selectionchange', handleDocumentSelection);
    };
  }, [pdfUrl, onTextSelect, documentText]);
  
  // Function to scroll to the top of the viewer
  const scrollToTop = () => {
    if (viewerContainerRef.current) {
      viewerContainerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  // Track scroll position to show/hide the scroll to top button
  useEffect(() => {
    const handleScroll = () => {
      if (viewerContainerRef.current) {
        setShowScrollToTop(viewerContainerRef.current.scrollTop > 300);
      }
    };

    const container = viewerContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

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
              onClick={zoomOut} 
              className="p-1 rounded text-blue-600 hover:bg-blue-100"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="mx-2 text-sm">{Math.round(scale * 100)}%</span>
            <button 
              onClick={zoomIn} 
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
            {!isLoading && numPages && (
              <>
                {/* Render all pages instead of just the current page */}
                {Array.from(new Array(numPages), (_, index) => (
                  <Page
                    key={`page_${index + 1}`}
                    pageNumber={index + 1}
                    scale={scale}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    className="shadow-md mt-4"
                    inputRef={(ref) => {
                      if (ref) {
                        // Add specific event listeners to the text layer when it's available
                        const textLayers = ref.querySelectorAll('.react-pdf__Page__textContent');
                        textLayers.forEach(layer => {
                          layer.addEventListener('mouseup', handleTextSelection);
                          // Make text selectable
                          (layer as HTMLElement).style.userSelect = 'text';
                          (layer as HTMLElement).style.cursor = 'text';
                        });
                      }
                    }}
                  />
                ))}
              </>
            )}
          </Document>
        ) : (
          // Fallback to iframe viewer
          renderFallbackIframe()
        )}
        
        {/* Scroll to top button */}
        {showScrollToTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow-lg z-50"
            title="Scroll to top"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}; 