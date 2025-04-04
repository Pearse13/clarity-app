import React, { useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import './PDFViewer.css';
import styled from 'styled-components';
import configurePdfWorker from '../utils/pdfConfig';

// Configure PDF.js worker
configurePdfWorker();

interface PDFViewerProps {
  file: string | { url: string } | { data: Uint8Array };
  onTextSelect?: (text: string) => void;
}

const PDFContainer = styled.div`
  position: relative;

  /* Fix overall text layer */
  .react-pdf__Page__textContent {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    overflow: visible !important;
    line-height: 1 !important;
    text-align: initial !important;
    pointer-events: auto !important;
    user-select: text !important;
    opacity: 1 !important;
    z-index: 2 !important;
  }

  /* All text layer spans */
  .react-pdf__Page__textContent span {
    cursor: text !important;
    color: rgba(0, 0, 0, 1) !important; /* Make text fully visible */
    pointer-events: auto !important;
    user-select: text !important;
  }

  /* Top-level text spans (likely paragraphs/bullets) */
  .react-pdf__Page__textContent > span {
    position: absolute !important;
    white-space: pre !important; 
    transform: none !important; /* Prevent transformation which breaks selection */
    background: transparent !important; /* Make backgrounds transparent */
    padding: 0 !important;
    margin: 0 !important;
  }

  /* Fix selection appearance */
  ::selection {
    background-color: rgba(59, 130, 246, 0.3) !important;
    color: black !important;
  }

  /* Fix canvas positioning */
  .react-pdf__Page__canvas {
    position: relative !important;
    z-index: 1 !important;
  }

  /* Fix page container */
  .react-pdf__Page {
    position: relative !important;
    overflow: visible !important;
    margin-bottom: 20px !important;
  }

  /* This fixes bullet point placement */
  .react-pdf__Page__textContent > span > span:first-child {
    margin-right: 0 !important;
  }

  /* Apply scale compensation for better positioning */
  @media screen {
    .react-pdf__Page__textContent {
      transform-origin: top left !important;
      transform: scale(1) !important;
    }
  }
`;

const PDFViewer: React.FC<PDFViewerProps> = ({ file, onTextSelect }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState<number>(0);

  // Handle text selection
  useEffect(() => {
    if (!containerRef.current || !onTextSelect) return;

    const handleSelection = () => {
      const selection = window.getSelection();
      if (selection && selection.toString()) {
        onTextSelect(selection.toString());
      }
    };

    containerRef.current.addEventListener('mouseup', handleSelection);
    
    return () => {
      containerRef.current?.removeEventListener('mouseup', handleSelection);
    };
  }, [onTextSelect]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  return (
    <PDFContainer ref={containerRef}>
      <Document 
        file={file}
        onLoadSuccess={onDocumentLoadSuccess}
      >
        {Array.from(new Array(numPages), (_, index) => (
          <Page
            key={`page_${index + 1}`}
            pageNumber={index + 1}
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        ))}
      </Document>
    </PDFContainer>
  );
};

export default PDFViewer; 