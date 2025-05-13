import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import type { TextItem, TextMarkedContent } from 'pdfjs-dist/types/src/display/api';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { ZoomIn, ZoomOut, ArrowUp } from 'lucide-react';
import { LoadingComponent, ErrorComponent } from './components/PDFViewerComponents';
import './PDFViewer.css';
import configurePdfWorker from '../../utils/pdfConfig';

// Configure PDF.js worker
configurePdfWorker();

// Debounce helper function
const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

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
  const [numPages, setNumPages] = useState<number | null>(null);
  const [scale, setScale] = useState<number>(defaultZoom);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollToTop, setShowScrollToTop] = useState<boolean>(false);
  
  // Always prefer the direct PDF URL for better text selection
  const pdfUrl = apiUrl || url;

  // Update container width on resize
  useEffect(() => {
    const updateWidth = debounce(() => {
      if (containerRef.current) {
        const width = containerRef.current.getBoundingClientRect().width;
        setContainerWidth(width);
      }
    }, 50);

    updateWidth(); // Initial width
    const resizeObserver = new ResizeObserver(updateWidth);
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Handle text selection
  useEffect(() => {
    const handleTextSelection = () => {
      const selection = window.getSelection();
      if (!selection || !selection.toString().trim() || !onTextSelect) return;

      // Get the selected text
      const selectedText = selection.toString().trim();
      
      // Only trigger if selection is within the PDF viewer
      const isWithinViewer = selection.anchorNode?.parentElement?.closest('.react-pdf__Page');
      if (isWithinViewer) {
        onTextSelect(selectedText);
      }
    };

    document.addEventListener('mouseup', handleTextSelection);
    return () => document.removeEventListener('mouseup', handleTextSelection);
  }, [onTextSelect]);

  // Handle document load success
  const onLoadSuccess = async ({ numPages }: { numPages: number }) => {
    console.log('PDFViewer: PDF load success');
    setNumPages(numPages);
    setIsLoading(false);
    
    try {
      console.log('PDFViewer: Beginning text extraction for', numPages, 'pages');
      const pdf = await pdfjs.getDocument(pdfUrl).promise;
      let fullText = '';
      
      // Extract text from each page
      for (let i = 1; i <= numPages; i++) {
        console.log(`PDFViewer: Extracting text from page ${i}/${numPages}`);
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: TextItem | TextMarkedContent) => 'str' in item ? item.str : '')
          .join(' ');
        fullText += pageText + '\n';
      }

      // Call callback with extracted text
      if (onDocumentTextExtracted) {
        onDocumentTextExtracted(fullText);
      }
    } catch (error) {
      console.error('PDFViewer: Error extracting PDF text:', error);
      if (onDocumentTextExtracted) {
        onDocumentTextExtracted(null);
      }
    }
  };

  // Handle document load error
  const onLoadError = (error: Error) => {
    setPdfError(error.message);
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-full" ref={containerRef}>
      {/* Document Header */}
      <div className="flex items-center justify-between p-3 bg-white border-b">
        {/* Page count on the left */}
        {numPages && (
          <span className="text-sm text-blue-600">
            All {numPages} pages Displayed
          </span>
        )}
        
        {/* Zoom controls on the right */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setScale(prev => Math.max(prev - 0.1, 0.5))}
            className="p-1.5 text-blue-600 hover:bg-gray-100 rounded-full transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-sm text-blue-600 min-w-[3rem] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale(prev => Math.min(prev + 0.1, 2))}
            className="p-1.5 text-blue-600 hover:bg-gray-100 rounded-full transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div 
        ref={viewerContainerRef}
        className="pdf-viewer-container overflow-auto flex-1 bg-gray-50 relative"
        onScroll={(e) => {
          const target = e.target as HTMLDivElement;
          setShowScrollToTop(target.scrollTop > 100);
        }}
      >
        {isLoading && <LoadingComponent />}
        {pdfError && <ErrorComponent error={pdfError} />}
        
        {!pdfError && (
          <Document
            file={pdfUrl}
            onLoadSuccess={onLoadSuccess}
            onLoadError={onLoadError}
            loading={<LoadingComponent />}
            error={<ErrorComponent error="Failed to load PDF" />}
            className="flex flex-col items-center w-full px-4"
          >
            {Array.from(new Array(numPages), (_, index) => (
              <Page
                key={`page_${index + 1}`}
                pageNumber={index + 1}
                scale={scale}
                className="mb-4 bg-white shadow-md"
                width={containerWidth ? containerWidth - 32 : undefined}
                loading={<div className="w-full h-32 bg-white" />}
                error={<ErrorComponent error={`Error loading page ${index + 1}`} />}
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            ))}
          </Document>
        )}
      
        {/* Scroll to top button */}
        {showScrollToTop && (
          <button
            onClick={() => viewerContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-4 left-4 p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-colors"
            title="Scroll to top"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default PDFViewer; 