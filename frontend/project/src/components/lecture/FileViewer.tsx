import React, { useEffect, useState, useRef } from 'react';
import { File, X, ArrowRight, Download } from 'lucide-react';
import { useFiles } from '../../contexts/FileContext';
import { UploadedFile } from '../../contexts/FileContext';
import { ocrService } from '../../services/ocr';
import mammoth from 'mammoth';
import LoadingSpinner from '../LoadingSpinner';

// Add CSS classes to enforce consistent layout with strict height limits
const CONTAINER_CLASSES = "h-full flex flex-col";
const HEADER_CLASSES = "text-center p-2 border-b bg-blue-50 flex-shrink-0";
const CONTENT_CLASSES = "flex-1 overflow-y-auto custom-scrollbar";

interface FileViewerProps {
  onAddToTransform?: (text: string) => void;
}

interface OcrProgress {
  status: string;
  progress: number;
}

// Create a dedicated WordViewer component
interface WordViewerProps {
  file: UploadedFile;
}

const WordViewer: React.FC<WordViewerProps> = ({ file }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Create Office Online Viewer URL
  const getOfficeViewerUrl = () => {
    if (!file.url) return '';
    
    // Make sure we use HTTPS URLs and encode
    const secureUrl = file.url.replace('http://', 'https://');
    const encodedFileUrl = encodeURIComponent(secureUrl);
    
    console.log('Using Office Online Viewer with URL:', secureUrl);
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodedFileUrl}&wdStartOn=1&wdEmbedCode=0`;
  };
  
  // Create Google Docs viewer URL as fallback
  const getGoogleViewerUrl = () => {
    if (!file.url) return '';
    
    // Make sure we use HTTPS URLs and encode
    const secureUrl = file.url.replace('http://', 'https://');
    return `https://docs.google.com/viewer?url=${encodeURIComponent(secureUrl)}&embedded=true`;
  };
  
  const viewerUrl = getOfficeViewerUrl();
  const googleViewerUrl = getGoogleViewerUrl();
  
  const [usingGoogleViewer, setUsingGoogleViewer] = useState(false);
  const currentViewerUrl = usingGoogleViewer ? googleViewerUrl : viewerUrl;

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Viewer toggle */}
      <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex justify-between items-center">
        <span className="text-sm text-blue-800">
          Using {usingGoogleViewer ? 'Google Docs' : 'Microsoft Office'} viewer
        </span>
        <button
          onClick={() => setUsingGoogleViewer(!usingGoogleViewer)}
          className="text-xs px-2 py-1 bg-white rounded border border-blue-200 text-blue-600 hover:bg-blue-50"
        >
          Try {usingGoogleViewer ? 'Microsoft Office' : 'Google Docs'} viewer
        </button>
      </div>
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 border-4 border-t-blue-500 border-r-transparent border-b-blue-500 border-l-transparent rounded-full animate-spin mb-2"></div>
            <p className="text-sm text-gray-600">Loading document...</p>
          </div>
        </div>
      )}
      
      {/* Error fallback */}
      {error && (
        <div className="p-4 flex flex-col items-center text-center">
          <p className="text-red-500 mb-2">{error}</p>
          <button
            onClick={() => setUsingGoogleViewer(!usingGoogleViewer)}
            className="px-3 py-1 bg-blue-500 text-white rounded mb-2"
          >
            Try {usingGoogleViewer ? 'Microsoft Office' : 'Google Docs'} viewer
          </button>
          <a 
            href={file.url} 
            download={file.name}
            className="text-blue-500 hover:underline text-sm"
          >
            Download document
          </a>
        </div>
      )}
      
      {/* Document viewer iframe */}
      <iframe
        src={currentViewerUrl}
        className="w-full flex-1"
        onLoad={() => {
          console.log(`${usingGoogleViewer ? 'Google' : 'Microsoft'} Word viewer loaded`);
          setIsLoading(false);
        }}
        onError={(e) => {
          console.error(`${usingGoogleViewer ? 'Google' : 'Microsoft'} Word viewer failed:`, e);
          setError(`Failed to load with ${usingGoogleViewer ? 'Google' : 'Microsoft'} viewer. Try the alternative.`);
          setIsLoading(false);
        }}
        style={{ border: 'none' }}
        title="Word Document"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
      />
    </div>
  );
};

// PowerPoint viewer component (similar to WordViewer)
interface PowerPointViewerProps {
  file: UploadedFile;
}

const PowerPointViewer: React.FC<PowerPointViewerProps> = ({ file }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Get and validate the public URL for the file
  const fileUrl = file.url || '';
  if (!file.url) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500">Error: No URL available for this file</div>
      </div>
    );
  }
  
  return (
    <div className="relative h-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
          <LoadingSpinner />
        </div>
      )}
      <iframe
        src={`https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`}
        className="w-full h-full border-0"
        onLoad={() => setIsLoading(false)}
        style={{ pointerEvents: 'auto' }}
      />
    </div>
  );
};

const FileViewer: React.FC<FileViewerProps> = ({ onAddToTransform }) => {
  const { files, removeFile } = useFiles();
  const currentFile = files[files.length - 1];
  const [selectedText, setSelectedText] = useState<string>('');
  const [ocrText, setOcrText] = useState<string>('');
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [docxContent, setDocxContent] = useState<string>('');
  const [isLoadingDocx, setIsLoadingDocx] = useState(false);
  const [docxError, setDocxError] = useState<string | null>(null);

  useEffect(() => {
    // Reset states when file changes
    setDocxContent('');
    setDocxError(null);
    setIsLoadingDocx(false);
    
    // Handle different file types
    if (currentFile) {
      if (currentFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        handleDocxFile();
      } else if (currentFile.type === 'text/html') {
        handleHtmlFile();
      } else if (currentFile.type === 'application/vnd.ms-powerpoint' || 
                 currentFile.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
        // Use the textContent if available, otherwise show the structured info
        if (currentFile.textContent) {
          setDocxContent(currentFile.textContent);
        }
      }
    }
  }, [currentFile]);

  useEffect(() => {
    // Clean up object URLs when component unmounts or file changes
    return () => {
      if (currentFile?.url) {
        URL.revokeObjectURL(currentFile.url);
      }
    };
  }, [currentFile]);

  useEffect(() => {
    // Initialize OCR worker when component mounts
    const initOcr = async () => {
      try {
        await ocrService.initialize((progress) => {
          setOcrProgress(progress);
        });
      } catch (error) {
        console.error('Failed to initialize OCR:', error);
        setOcrError('Failed to initialize OCR. Please try again.');
      }
    };

    initOcr();

    // Clean up OCR worker when component unmounts
    return () => {
      ocrService.terminate();
    };
  }, []);

  useEffect(() => {
    // Add click handler to clear selection when clicking outside
    const handleDocumentClick = () => {
      const selection = window.getSelection();
      if (!selection || selection.toString().trim() === '') {
        setSelectedText('');
        if (onAddToTransform) {
          onAddToTransform('');
        }
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
    };
  }, [onAddToTransform]);

  const handleTextSelection = () => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() || '';
    
    // Only update if we have actual text selected
    if (selectedText.length > 0) {
      console.log(`Text selected (${selectedText.length} chars)`);
      setSelectedText(selectedText);
      
      // Show visual feedback for selection
      const range = selection?.getRangeAt(0);
      if (range) {
        // Remove any existing highlights
        document.querySelectorAll('.text-highlight').forEach(el => {
          const parent = el.parentNode;
          if (parent) {
            parent.replaceChild(document.createTextNode(el.textContent || ''), el);
          }
        });

        // Create highlight span
        const span = document.createElement('span');
        span.className = 'text-highlight';
        range.surroundContents(span);
      }

      // Send to transformer
      if (onAddToTransform) {
        onAddToTransform(selectedText);
      }
    }
  };

  // Add CSS for highlight effect
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .text-highlight {
        background-color: rgba(59, 130, 246, 0.2);
        border-radius: 2px;
        transition: background-color 0.2s ease;
      }
      .text-highlight:hover {
        background-color: rgba(59, 130, 246, 0.3);
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  
  const handleOcr = async () => {
    if (!currentFile?.url) return;

    setOcrError(null);
    setOcrText('');
    
    try {
      const text = await ocrService.recognizeImage(currentFile.url);
      setOcrText(text);
      if (onAddToTransform) {
        onAddToTransform(text);
      }
    } catch (error) {
      console.error('OCR failed:', error);
      setOcrError('Failed to extract text from image. Please try again.');
    }
  };

  const handleDocxFile = async () => {
    if (!currentFile?.url) return;

    setIsLoadingDocx(true);
    setDocxError(null);

    try {
      const reader = new FileReader();
      
      const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
        return new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = () => reject(reader.error);
          reader.readAsArrayBuffer(file);
        });
      };

      if (!currentFile.file) {
        throw new Error('Original file not available');
      }

      const arrayBuffer = await readFileAsArrayBuffer(currentFile.file);
      
      const [textResult, htmlResult] = await Promise.all([
        mammoth.extractRawText({ arrayBuffer }),
        mammoth.convertToHtml({ arrayBuffer })
      ]);

      let combinedText = textResult.value || '';

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlResult.value;
      const images = Array.from(tempDiv.getElementsByTagName('img'));

      if (images.length > 0) {
        setOcrProgress({ status: 'Processing images from document...', progress: 0 });
        
        for (let i = 0; i < images.length; i++) {
          const image = images[i];
          const imageUrl = image.src;
          
          try {
            if (!ocrService.isInitialized) {
              await ocrService.initialize((progress) => {
                setOcrProgress(progress);
              });
            }
            
            const imageText = await ocrService.recognizeImage(imageUrl);
            if (imageText.trim()) {
              combinedText += '\n\n[Image Text]:\n' + imageText;
            }
            
            setOcrProgress({ 
              status: `Processing image ${i + 1} of ${images.length}...`, 
              progress: (i + 1) / images.length 
            });
          } catch (error) {
            console.error('Failed to process image:', error);
            combinedText += '\n\n[Image Processing Failed]';
          }
        }
        
        setOcrProgress({ status: 'Completed', progress: 1 });
      }
      
      setDocxContent(combinedText);
    } catch (error) {
      console.error('DOCX processing error:', error);
      setDocxError('Failed to process DOCX file. Please try downloading it instead.');
    } finally {
      setIsLoadingDocx(false);
      setOcrProgress(null);
    }
  };

  const handleHtmlFile = async () => {
    if (!currentFile?.file) return;

    try {
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result;
          if (typeof content === 'string') {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = content;
            
            const scripts = tempDiv.getElementsByTagName('script');
            while (scripts[0]) {
              scripts[0].parentNode?.removeChild(scripts[0]);
            }
            
            resolve(tempDiv.innerHTML);
          } else {
            reject(new Error('Failed to read HTML content'));
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsText(currentFile.file);
      });

      setDocxContent(text);
    } catch (error) {
      console.error('Error reading HTML file:', error);
      setDocxError('Failed to read HTML file. Please try a different format.');
    }
  };

  const renderContent = () => {
    if (!currentFile) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-500">No file selected</div>
        </div>
      );
    }

    // Handle PowerPoint files
    if (currentFile.type === 'application/vnd.ms-powerpoint' || 
        currentFile.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      return <PowerPointViewer file={currentFile} />;
    }
    
    // Handle Word documents with dedicated viewer
    if (currentFile.type === 'application/msword' || 
        currentFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return <WordViewer file={currentFile} />;
    }

    if (currentFile.progress !== 100) {
      return (
        <div className="text-center w-full">
          <div className="w-full max-w-xs mx-auto mb-4">
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${currentFile.progress}%` }}
              />
            </div>
          </div>
          <p className="text-sm text-gray-600">
            Uploading... {currentFile.progress}%
          </p>
        </div>
      );
    }

    // For text files, display in a pre tag with conditional "Add to Understand" button
    if (currentFile.type === 'text/plain') {
      return (
        <div className={CONTAINER_CLASSES}>
          <div className={HEADER_CLASSES}>
            <h3 className="text-sm font-semibold text-blue-800">{currentFile.name}</h3>
          </div>
          <div className={CONTENT_CLASSES}>
            <pre 
              onMouseUp={handleTextSelection}
              onKeyUp={handleTextSelection}
              className="p-4 bg-white rounded border text-sm font-mono whitespace-pre-wrap selection:bg-blue-100"
            >
              {currentFile.textContent || 'Loading text content...'}
            </pre>
          </div>
        </div>
      );
    }

    // For Word documents (DOCX)
    if (currentFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        currentFile.type === 'application/msword') {
      
      // Check if we have a PDF URL from backend conversion
      const isPdfUrl = currentFile.url && currentFile.url.includes('.pdf');
      
      // If we have a PDF URL from the backend conversion, use the PDF viewer
      if (isPdfUrl) {
        return (
          <div className={CONTAINER_CLASSES}>
            <div className={HEADER_CLASSES}>
              <h3 className="text-sm font-semibold text-blue-800">
                {currentFile.name} (Converted to PDF)
              </h3>
            </div>
            <div className={CONTENT_CLASSES} style={{ padding: 0 }}>
              <iframe
                src={currentFile.url}
                className="w-full h-full border-0"
                title={`${currentFile.name} (PDF)`}
              />
            </div>
          </div>
        );
      }
      
      // If we have text content extracted from the document (by the backend or locally)
      if (currentFile.textContent) {
        return (
          <div className={CONTAINER_CLASSES}>
            <div className={HEADER_CLASSES}>
              <h3 className="text-sm font-semibold text-blue-800">{currentFile.name}</h3>
            </div>
            <div className={CONTENT_CLASSES}>
              <pre 
                onMouseUp={handleTextSelection}
                onKeyUp={handleTextSelection}
                className="p-4 bg-white rounded border text-sm font-mono whitespace-pre-wrap selection:bg-blue-100"
              >
                {currentFile.textContent}
              </pre>
            </div>
          </div>
        );
      }
      
      // Otherwise, show the standard processing state or mammoth.js fallback
      return (
        <div className={CONTAINER_CLASSES}>
          <div className={HEADER_CLASSES}>
            <h3 className="text-sm font-semibold text-blue-800">{currentFile.name}</h3>
          </div>
          <div className={CONTENT_CLASSES}>
            {isLoadingDocx ? (
              <div className="flex items-center justify-center h-full w-full">
                <div className="animate-spin text-blue-600 mr-2">↻</div>
                <span className="text-sm text-gray-600">Processing document...</span>
              </div>
            ) : docxError ? (
              <div className="text-center p-8 w-full">
                <File className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <p className="text-red-500 text-sm mb-4">{docxError}</p>
                <a 
                  href={currentFile.url} 
                  download={currentFile.name}
                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  Download Document
                </a>
              </div>
            ) :
              <pre 
                onMouseUp={handleTextSelection}
                onKeyUp={handleTextSelection}
                className="p-4 bg-white rounded border text-sm font-mono whitespace-pre-wrap selection:bg-blue-100"
              >
                {docxContent || "Processing document content..."}
              </pre>
            }
          </div>
        </div>
      );
    }

    // For HTML files, display in a sandboxed div
    if (currentFile.type === 'text/html') {
      return (
        <div className={CONTAINER_CLASSES}>
          <div className={HEADER_CLASSES}>
            <h3 className="text-sm font-semibold text-blue-800">{currentFile.name}</h3>
          </div>
          <div className={CONTENT_CLASSES}>
            <div className="bg-white rounded-lg shadow-sm">
              {/* Tooltip guide */}
              {!selectedText && (
                <div className="sticky top-4 left-1/2 transform -translate-x-1/2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-medium shadow-sm animate-bounce z-10 w-fit mx-auto">
                  Select any text to understand it better
                </div>
              )}
              <div 
                onMouseUp={handleTextSelection}
                onKeyUp={handleTextSelection}
                className="p-4 selection:bg-blue-100 selection:text-blue-900 transition-all duration-200"
                dangerouslySetInnerHTML={{ 
                  __html: docxContent || 'Loading HTML content...' 
                }} 
              />
            </div>
          </div>
        </div>
      );
    }

    // For PDFs, display in an iframe
    if (currentFile.type === 'application/pdf') {
      return (
        <div className={CONTAINER_CLASSES}>
          <div className={HEADER_CLASSES}>
            <h3 className="text-sm font-semibold text-blue-800">{currentFile.name}</h3>
          </div>
          <div className={CONTENT_CLASSES} style={{ padding: 0 }}>
            <iframe
              src={currentFile.url}
              className="w-full h-full border-0"
              title={currentFile.name}
            />
          </div>
        </div>
      );
    }

    // For images, display the image with OCR button
    if (currentFile.type.startsWith('image/')) {
      return (
        <div className={CONTAINER_CLASSES}>
          <div className={HEADER_CLASSES}>
            <h3 className="text-sm font-semibold text-blue-800">{currentFile.name}</h3>
          </div>
          <div className={CONTENT_CLASSES}>
            <div className="flex flex-col items-center p-4">
              <div className="relative mb-4 max-w-full">
                <img
                  src={currentFile.url}
                  alt={currentFile.name}
                  className="max-h-[200px] max-w-full object-contain rounded-lg"
                />
                <button
                  onClick={() => removeFile(currentFile.id)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={handleOcr}
                disabled={!!ocrProgress}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {ocrProgress ? ocrProgress.status : 'Extract Text from Image'}
              </button>
              {ocrProgress && (
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${ocrProgress.progress * 100}%` }}
                  />
                </div>
              )}
              {ocrError && (
                <p className="text-sm text-red-500">{ocrError}</p>
              )}
              {ocrText && (
                <div className="mt-4 w-full">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Extracted Text:</h4>
                  <pre className="p-4 bg-gray-50 rounded-lg text-sm font-mono whitespace-pre-wrap selection:bg-blue-100">
                    {ocrText}
                  </pre>
                  {onAddToTransform && (
                    <button
                      data-ocr-transform-button
                      onClick={() => onAddToTransform(ocrText)}
                      className="mt-4 flex items-center justify-center gap-2 w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      <ArrowRight className="w-4 h-4" />
                      Add to Understand
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={CONTAINER_CLASSES}>
        <div className={HEADER_CLASSES}>
          <h3 className="text-sm font-semibold text-blue-800">{currentFile.name || "Unknown file"}</h3>
        </div>
        <div className={CONTENT_CLASSES}>
          <div className="text-center p-8">
            <File className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">Preview not available for this file type</p>
            <a 
              href={currentFile.url} 
              download={currentFile.name}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Download File
            </a>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <File className="w-5 h-5 text-blue-600" />
          <span className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
            {currentFile.name}
          </span>
        </div>
        <button
          onClick={() => removeFile(currentFile.id)}
          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Remove file"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* File Preview Area */}
      <div className="flex-1 min-h-0 bg-gray-50 p-4 h-full">
        {renderContent()}
      </div>
    </div>
  );
};

export default FileViewer; 