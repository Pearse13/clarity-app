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
  className?: string;
  onReset?: () => void;
  isMinimized?: boolean;
  activeTab?: 'understand' | 'chat' | 'teach';
};

type ApiHealth = {
  status: string;
  timestamp: string;
};

// Using the existing UploadResponse as our PresentationData type
type PresentationData = {
  id: string;
  document_id: string;
  status: 'ready' | 'processing' | 'error';
  url: string;
  filename: string;
  type: string;
  apiUrl?: string; // Original API URL for PDFs
  alternativeUrl?: string;
  error?: string;
  check_status_url?: string;
  isPowerPoint?: boolean;
  isWord?: boolean;
  useDirectViewer?: boolean;
  possibleUrls?: string[];
};

type UploadResponse = {
  id: string;
  document_id: string;
  status: 'ready' | 'processing' | 'error';
  url: string;
  filename: string;
  type: string;
  apiUrl?: string; // Original API URL for PDFs
  alternativeUrl?: string;
  error?: string;
  check_status_url?: string;
  isPowerPoint?: boolean;
  isWord?: boolean;
  useDirectViewer?: boolean;
  possibleUrls?: string[];
};

type FileStatusResponse = {
  document_id: string;
  status: 'ready' | 'processing' | 'error';
  filename?: string;
  file_url?: string;
  error?: string;
  filesize?: number;
};

const SUPPORTED_FILE_TYPES = {
  '.ppt': 'PowerPoint',
  '.pptx': 'PowerPoint',
  '.doc': 'Word',
  '.docx': 'Word',
  '.pdf': 'PDF'
};

// Update the label element's type definition
type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

// Export the component with forwardRef to allow parent components to access its methods
export const PresentationViewer = forwardRef<
  { resetPresentation: () => void },
  PresentationViewerProps
>(({ 
  onTextSelect, 
  onDocumentTextExtracted, 
  className = '', 
  onReset,
  isMinimized = false,
  activeTab = 'understand'
}, ref) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [presentation, setPresentation] = useState<UploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [iframeError, setIframeError] = useState<string | null>(null);
  const [iframeLoading, setIframeLoading] = useState<boolean>(true);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiUrl = (process.env.VITE_PRODUCTION_API_URL || 'https://clarity-backend-production.up.railway.app').replace('http://', 'https://');
  const [presentationData, setPresentationData] = useState<PresentationData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState<string>('');
  const [showDebug, setShowDebug] = useState<boolean>(false);

  // API health checking
  const [apiHealth, setApiHealth] = useState<ApiHealth | null>(null);

  // In the component state declarations
  const [uploadStage, setUploadStage] = useState<'idle' | 'uploading' | 'processing' | 'converting'>('idle');
  const [uploadMessage, setUploadMessage] = useState<string>('Uploading file...');

  // Check if the backend API is accessible
  useEffect(() => {
    const checkBackendAccess = async () => {
      try {
        console.log('Checking backend API access at:', apiUrl);
        
        // Try with regular fetch first
        try {
          const response = await fetch(`${apiUrl}/health`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Origin': window.location.origin
            },
            mode: 'cors'
          });
          
          console.log('Backend API health check status:', response.status);
          if (response.ok) {
            const data = await response.json();
            console.log('Backend API health check response:', data);
            setApiHealth({
              status: data.status,
              timestamp: data.timestamp
            });
            return; // Successful API call, exit the function
          } else {
            console.error('Backend API health check failed with status:', response.status);
            // Continue to try alternative methods
          }
        } catch (fetchError) {
          console.error('Initial fetch attempt failed:', fetchError);
          // Continue to try alternative methods
        }
        
        // If we get here, the initial fetch failed. Try with no-cors mode
        try {
          console.log('Trying with no-cors mode');
          const noCorsFetch = await fetch(`${apiUrl}/health`, {
            method: 'GET',
            mode: 'no-cors'
          });
          
          // no-cors won't give us the response content but at least tells us if the server is reachable
          console.log('Backend reachable with no-cors mode, status:', noCorsFetch.status, noCorsFetch.type);
          
          // Since we can't get data from no-cors, set a generic health status
          setApiHealth({
            status: 'reachable',
            timestamp: new Date().toISOString()
          });
        } catch (noCorsError) {
          console.error('No-cors attempt also failed:', noCorsError);
          // Final fallback warning
          console.warn('Backend API may not be accessible due to network or certificate issues');
        }
      } catch (err) {
        console.error('Error in checkBackendAccess:', err);
      }
    };
    
    checkBackendAccess();
  }, []);

  // Clean up selected text by removing CSS and unwanted content
  const cleanSelectedText = (text: string): string => {
    // Remove CSS-like content
    const cleanText = text.replace(/slide \* {[^}]*}|[a-z]+ {[^}]*}/gi, '')
      // Remove multiple spaces
      .replace(/\s+/g, ' ')
      // Remove empty lines
      .replace(/^\s*[\r\n]/gm, '')
      // Trim whitespace
      .trim();
    
    return cleanText;
  };

  // Handle text selection from PDF viewer
  const handlePDFTextSelection = useCallback((text: string, extractedDocText?: string) => {
    console.log('PresentationViewer: Received text from PDF viewer:', text);
    console.log('PresentationViewer: onTextSelect prop is', onTextSelect ? 'provided' : 'not provided');
    
    if (text && onTextSelect) {
      const cleanText = cleanSelectedText(text);
      console.log('PresentationViewer: Clean text to send to parent:', cleanText);
      if (cleanText) {
        console.log('PresentationViewer: Calling onTextSelect with clean text');
        onTextSelect(cleanText, extractedDocText);
      } else {
        console.log('PresentationViewer: Clean text is empty, not calling onTextSelect');
      }
    } else {
      console.log('PresentationViewer: Text empty or onTextSelect not provided');
    }
  }, [onTextSelect, cleanSelectedText]);

  // Add event handler to prevent text selection from outside the PDF viewer from being processed
  useEffect(() => {
    if (!onTextSelect) return;
    
    // Prevent regular text selection from occurring at the document level
    const preventDocumentSelection = (e: MouseEvent) => {
      // Only apply if we have a document loaded
      if (!presentationData) return;
      
      // Get the target element
      const target = e.target as HTMLElement;
      
      // Check if the target is part of the PDF viewer content
      const isDocumentContent = (
        target.tagName === 'IFRAME' ||
        target.closest('iframe') ||
        target.classList.contains('react-pdf__Page') ||
        !!target.closest('.react-pdf__Page') ||
        target.classList.contains('document-viewer-area') ||
        !!target.closest('.document-viewer-area')
      );
      
      if (!isDocumentContent) {
        console.log('PresentationViewer: Mouse event outside document content - ignore for text selection');
        // Don't prevent default, just log that this selection should be ignored
      }
    };
    
    // Add the event listener to track where the selection begins
    document.addEventListener('mousedown', preventDocumentSelection);
    
    return () => {
      document.removeEventListener('mousedown', preventDocumentSelection);
    };
  }, [presentationData, onTextSelect]);

  // Add progress simulation
  useEffect(() => {
    let progressInterval: NodeJS.Timeout;
    
    if (uploading && uploadProgress < 100) {
      progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          // More natural progression
          if (prev < 30) return prev + 2;
          if (prev < 60) return prev + 1;
          if (prev < 90) return prev + 0.5;
          if (prev < 100) return prev + 0.2;  // Allow it to reach 100
          return 100;
        });
      }, 150);
    }

    return () => {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
    };
  }, [uploading, uploadProgress]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Get file extension
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();

    // Validate file type
    if (!Object.keys(SUPPORTED_FILE_TYPES).includes(fileExt)) {
      setError(`Please select a supported file type (${Object.values(SUPPORTED_FILE_TYPES).join(', ')})`);
      return;
    }

    try {
      setUploading(true);
      setIsLoading(true);
      setUploadProgress(0);
      setError(null);
      setIframeError(null);
      setUploadStage('uploading');
      setUploadMessage('Uploading file...');

      const formData = new FormData();
      formData.append('file', file);

      console.log('Starting file upload...', {
        filename: file.name,
        size: file.size,
        type: file.type
      });

      // Determine appropriate message based on file type
      if (fileExt === '.pdf') {
        setUploadMessage('Uploading PDF document...');
      } else if (['.ppt', '.pptx'].includes(fileExt)) {
        setUploadMessage('Uploading PowerPoint presentation...');
      } else if (['.doc', '.docx'].includes(fileExt)) {
        setUploadMessage('Uploading Word document...');
      }

      // Use the production API URL
      const response = await fetch(`${apiUrl}/api/presentations/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          'Origin': window.location.origin
        },
        mode: 'cors'
      });

      console.log('Upload response status:', response.status);

      // Update stage to processing after upload completes
      setUploadStage('processing');
      if (['.ppt', '.pptx'].includes(fileExt)) {
        setUploadMessage('Converting PowerPoint to viewable format...');
      } else if (['.doc', '.docx'].includes(fileExt)) {
        setUploadMessage('Converting Word document to viewable format...');
      } else if (fileExt === '.pdf') {
        setUploadMessage('Processing PDF document...');
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${errorText}`);
      }

      const responseData = await response.json();
      console.log('Upload response:', responseData);

      if (!responseData.document_id) {
        throw new Error('No document ID received from server');
      }

      // Handle Word documents - they may come back as converted PDFs
      if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
          file.type === 'application/msword') {
        
        console.log('Word document uploaded, checking type...');
        
        // Check if it's been converted to PDF
        if (responseData.type === 'PDF') {
          console.log('Word document converted to PDF, using PDF viewer');
          
          // Use the PDF viewer for the converted Word document
          if (!responseData.file_url) {
            throw new Error('No file URL provided in the response for PDF');
          }
          
          try {
            setIframeLoading(true);
            
            const documentData: PresentationData = {
              id: responseData.document_id,
              document_id: responseData.document_id,
              status: 'ready',
              url: responseData.file_url,
              filename: file.name,
              type: 'pdf',
              apiUrl: responseData.file_url,
              isWord: false // Treat as PDF now
            };
            
            setUploadProgress(100);
            setPresentation(documentData);
            setPresentationData(documentData); // Add to presentationData state
            setIframeLoading(false);
            
            console.log('Word document converted to PDF, viewer setup complete:', documentData);
            return;
          } catch (error) {
            console.error('Error setting up PDF viewer for converted Word document:', error);
            setError('Failed to process converted Word document. Please try again.');
            setUploadError('Failed to process converted Word document. Please try again.');
            setUploading(false);
            setIsLoading(false);
            return;
          }
        } else {
          // Handle as regular Word document
          console.log('Word document uploaded, setting up Word viewer...');
          
          // Create Word document viewer URLs
          // Get base URL for the API
          const baseApiUrl = apiUrl.replace('/api/presentations/upload', '');
          
          // Create direct access URL for the file - make sure we use the file_ext which has the right extension
          const directFileUrl = `${baseApiUrl}/api/presentations/documents/${responseData.document_id}/${responseData.document_id}${fileExt}`;
          console.log('Word document direct URL:', directFileUrl);
          
          // Create Office viewer URL with proper encoding
          const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(directFileUrl)}&wdStartOn=1&wdEmbedCode=0`;
          console.log('Word document Office viewer URL:', officeViewerUrl);
          
          const documentData: PresentationData = {
            id: responseData.document_id,
            document_id: responseData.document_id,
            status: 'ready',
            url: officeViewerUrl,
            filename: file.name,
            type: 'word',
            apiUrl: directFileUrl,
            isWord: true
          };
          
          setUploadProgress(100);
          setPresentation(documentData);
          setPresentationData(documentData);
          setIframeLoading(false);
          
          console.log('Word document viewer setup complete:', documentData);
          
          // Signal document text is available to enable "Upload Another" button
          onDocumentTextExtracted?.(`[Word Document]: ${file.name}`);
          
          return;
        }
      }

      // Handle PowerPoint files - now they may come back as converted PDFs
      if (file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
          file.type === 'application/vnd.ms-powerpoint') {
        
        console.log('PowerPoint file uploaded, checking type...');
        
        // Check if it's been converted to PDF
        if (responseData.type === 'PDF') {
          console.log('PowerPoint converted to PDF, using PDF viewer');
          
          // Use the PDF viewer for the converted PowerPoint
          if (!responseData.file_url) {
            throw new Error('No file URL provided in the response for PDF');
          }
          
          try {
            setIframeLoading(true);
            
            const documentData: PresentationData = {
              id: responseData.document_id,
              document_id: responseData.document_id,
              status: 'ready',
              url: responseData.file_url,
              filename: file.name,
              type: 'pdf',
              apiUrl: responseData.file_url,
              isPowerPoint: false // Treat as PDF now
            };
            
            setUploadProgress(100);
            setPresentation(documentData);
            setPresentationData(documentData); // Add to presentationData state
            setIframeLoading(false);
            
            console.log('PowerPoint converted to PDF, viewer setup complete:', documentData);
            return;
          } catch (error) {
            console.error('Error setting up PDF viewer for converted PowerPoint:', error);
            setError('Failed to process converted PowerPoint file. Please try again.');
            setUploadError('Failed to process converted PowerPoint file. Please try again.');
            setUploading(false);
            setIsLoading(false);
            return;
          }
        } else {
          // Handle as regular PowerPoint
          console.log('PowerPoint file uploaded, setting up PowerPoint viewer...');
          setupPowerPointViewing(responseData);
          return;
        }
      }

      // Handle PDF files
      if (file.type === 'application/pdf') {
        console.log('PDF file uploaded, processing...');
        
        // Make sure we have a file URL in the response
        if (!responseData.file_url) {
          throw new Error('No file URL provided in the response for PDF');
        }
        
        const pdfUrl = responseData.file_url;
        console.log('PDF URL from response:', pdfUrl);
        
        try {
          setIframeLoading(true);
          
          // IMPORTANT: Use the direct PDF URL as the primary URL for better text selection
          // We no longer use Google Drive viewer as it prevents text selection
          const presentationData: PresentationData = {
            id: responseData.document_id,
            document_id: responseData.document_id,
            status: 'ready',
            url: pdfUrl, // Use direct PDF URL as primary
            filename: file.name,
            type: 'pdf',
            apiUrl: pdfUrl  // Same URL as backup
          };
          
          setUploadProgress(100);
          setPresentation(presentationData);
          setPresentationData(presentationData); // Also set the presentationData state
          
          // Set iframeLoading to false since the PDFViewer component will handle its own loading state
          setIframeLoading(false);
          
          console.log('PDF display data prepared:', presentationData);
        } catch (error) {
          console.error('Error setting up PDF viewer:', error);
          setError('Failed to process PDF file. Please try again.');
          setUploading(false);
        }
        return;
      }
      
      // After a successful upload, update the uploadStage based on file type
      if (responseData?.status === 'ready' && responseData?.file_url) {
        // If it's a PDF, we need to show the processing stage differently
        if (responseData.filename?.toLowerCase().endsWith('.pdf')) {
          setUploadStage('processing');
          setUploadMessage('Processing PDF document...');
        } 
        // For PowerPoint and Word, we show converting stage
        else if (responseData.filename?.toLowerCase().endsWith('.ppt') || 
                 responseData.filename?.toLowerCase().endsWith('.pptx') ||
                 responseData.filename?.toLowerCase().endsWith('.doc') || 
                 responseData.filename?.toLowerCase().endsWith('.docx')) {
          setUploadStage('converting');
          setUploadMessage(
            responseData.filename?.toLowerCase().endsWith('.doc') || 
            responseData.filename?.toLowerCase().endsWith('.docx')
              ? 'Converting Word document...'
              : 'Converting PowerPoint presentation...'
          );
        }
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload file. Please try again.');
      setUploadError(err instanceof Error ? err.message : 'Failed to upload file. Please try again.');
      setUploading(false);
      setIsLoading(false);
      setUploadStage('idle');
    } finally {
      if (presentationData) {
        setUploading(false);
        setIsLoading(false);
      }
    }
  };

  // Function to check if a URL is accessible
  const checkUrlAccessible = async (url: string): Promise<boolean> => {
    try {
      console.log('Checking if URL is accessible:', url);
      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'Accept': 'application/json',
          'Origin': window.location.origin
        },
        mode: 'cors'
      });
      
      console.log('URL check status:', response.status);
      return response.ok;
    } catch (err) {
      console.error('Error checking URL:', err);
      return false;
    }
  };

  // Function to fetch the PDF as a blob and create a data URL
  const fetchPdfAsDataUrl = async (url: string): Promise<string | null> => {
    try {
      console.log('Fetching PDF as data URL from:', url);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf',
          'Origin': window.location.origin
        },
        mode: 'cors'
      });
      
      if (!response.ok) {
        console.error('Failed to fetch PDF:', response.status);
        return null;
      }
      
      const blob = await response.blob();
      const dataUrl = URL.createObjectURL(blob);
      console.log('Created data URL for PDF:', dataUrl);
      return dataUrl;
    } catch (err) {
      console.error('Error fetching PDF as data URL:', err);
      return null;
    }
  };

  // Add a function to handle iframe load
  const handleIframeLoad = useCallback((event: React.SyntheticEvent<HTMLIFrameElement>) => {
    console.log('iframe loaded');
    setIframeLoading(false);
    setIframeError(null);
  }, []);

  // Add a function to open the PDF in a new tab
  const openInNewTab = useCallback(() => {
    if (presentation?.url) {
      window.open(presentation.url, '_blank');
    }
  }, [presentation]);

  // Add a function to try the API URL
  const tryApiUrl = useCallback(() => {
    if (presentation?.apiUrl) {
      console.log('Trying API URL:', presentation.apiUrl);
      setIframeLoading(true);
      setIframeError(null);
      setPresentation(prev => {
        if (!prev) return null;
        return { 
          ...prev, 
          url: presentation.apiUrl || prev.url // Ensure url is never undefined
        };
      });
    }
  }, [presentation]);

  // Handle object load event for PDFs
  const handleObjectLoad = (event: React.SyntheticEvent<HTMLObjectElement>) => {
    console.log('PDF object loaded successfully');
    
    // Delay setting loading to false to ensure content is rendered
    setTimeout(() => {
      setIframeLoading(false);
      setIframeError(null);
      setRetryCount(0);
    }, 500);
  };

  const handleObjectError = (event: React.SyntheticEvent<HTMLObjectElement>) => {
    console.error('PDF object error:', event);
    setIframeError('Failed to load PDF preview. You can try opening it directly in your browser.');
    setIframeLoading(false);
  };

  const handleIframeError = (event: React.SyntheticEvent<HTMLIFrameElement>) => {
    console.error('iframe error:', event);
    setIframeError('Failed to load file preview');
    setIframeLoading(false);
  };

  // Add a timeout for PowerPoint loading
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (presentation?.isPowerPoint && iframeLoading) {
      // Set a timeout to show a download option if the PowerPoint viewer takes too long to load
      timeoutId = setTimeout(() => {
        console.log('PowerPoint viewer taking too long to load, showing download option');
        setIframeError('The PowerPoint viewer is taking longer than expected. The file may be too large or temporarily unavailable.');
      }, 15000); // 15 seconds timeout
    }
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [presentation, iframeLoading]);

  const startPolling = useCallback(async (statusUrl: string) => {
    console.log('Starting polling for file status...');
    let attempts = 0;
    const maxAttempts = 30; // 30 attempts * 2 seconds = 1 minute maximum wait
    
    const poll = async () => {
      try {
        // If we have a check_status_url, use it to check file status
        if (statusUrl) {
          console.log('Polling for file status:', statusUrl);
          
          setUploadStage('processing');
          setUploadMessage('Converting document for viewing...');
          
          const response = await fetch(statusUrl, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Origin': window.location.origin
            },
            mode: 'cors'
          });
          
          const responseData: FileStatusResponse = await response.json();
          console.log('Polling response:', responseData);

          if (responseData.status === 'ready') {
            console.log('File is ready, stopping polling');
            if (pollingInterval) clearInterval(pollingInterval);
            await setupPowerPointViewing(responseData);
            return;
          }

          if (responseData.status === 'error') {
            console.error('Processing error:', responseData.error);
            if (pollingInterval) clearInterval(pollingInterval);
            throw new Error(responseData.error || 'Processing failed');
          }

          attempts++;
          if (attempts >= maxAttempts) {
            if (pollingInterval) clearInterval(pollingInterval);
            throw new Error('Processing timed out');
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
        if (pollingInterval) clearInterval(pollingInterval);
        throw error;
      }
    };
    
    // Start polling every 2 seconds
    const interval = setInterval(poll, 2000);
    setPollingInterval(interval);
    
    // Initial poll
    await poll();
    
    // Cleanup on unmount
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
    };
  }, [pollingInterval]);

  const checkFileAccess = async (docId: string, maxRetries = 10): Promise<boolean> => {
    try {
        const fileUrl = `${apiUrl}/api/presentations/documents/${docId}/${docId}.pptx`;
        console.log('Checking file access at:', fileUrl);
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`File access check attempt ${attempt}/${maxRetries}`);
                const response = await fetch(fileUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                        'Origin': window.location.origin,
                        'Range': 'bytes=0-0'  // Request only the first byte to check accessibility
                    },
                    mode: 'cors'
                });
                
                if (response.ok || response.status === 206) {  // 206 is Partial Content response
                    console.log('File is accessible');
                    return true;
                }
                
                console.log(`File not accessible (status: ${response.status})`);
                
                // If not accessible, wait before retry
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (err) {
                console.log(`Attempt ${attempt} failed:`, err);
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
        
        console.log('File access check failed after all retries');
        return false;
    } catch (err) {
        console.log('File access check failed:', err);
        return false;
    }
};

  const setupPowerPointViewing = async (fileData: FileStatusResponse) => {
    try {
      console.log('Setting up PowerPoint viewing:', fileData);
      
      // Update message for conversion process
      setUploadStage('converting');
      setUploadMessage('Preparing document for viewing...');
      
      if (fileData.status === 'ready' && fileData.file_url) {
        const fileUrl = fileData.file_url;
        
        // Check if it's PPTX/PPT
        const isPowerPoint = fileData.filename?.toLowerCase().endsWith('.ppt') || 
                             fileData.filename?.toLowerCase().endsWith('.pptx');
          
        // Check if it's DOC/DOCX
        const isWord = fileData.filename?.toLowerCase().endsWith('.doc') || 
                       fileData.filename?.toLowerCase().endsWith('.docx');
        
        // Update message based on file type
        if (isPowerPoint) {
          setUploadMessage('Finalizing PowerPoint conversion...');
        } else if (isWord) {
          setUploadMessage('Finalizing Word document conversion...');
        } else {
          setUploadMessage('Loading document...');
        }
        
        // Set presentation data
        setPresentationData({
          id: '',
          document_id: fileData.document_id,
          status: 'ready',
          url: fileUrl,
          filename: fileData.filename || 'document',
          type: isPowerPoint ? 'powerpoint' : isWord ? 'word' : 'pdf',
          isPowerPoint,
          isWord
        });
        
        setUploading(false);
        setIsLoading(false);
        setUploadProgress(100);
      } else if (fileData.status === 'processing') {
        // Still processing, continue polling
        console.log('File still processing, continue polling...');
        return false;
      } else if (fileData.status === 'error') {
        // Handle error
        throw new Error(fileData.error || 'Error processing file');
      }
      
      return true;
    } catch (error) {
      console.error('Error setting up document viewing:', error);
      setError((error as Error).message || 'Error setting up document viewing');
      setUploadError((error as Error).message || 'Error setting up document viewing');
      setIsLoading(false);
      setUploading(false);
      return false;
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
    };
  }, [pollingInterval]);

  // Function to handle text selection from PDF or PowerPoint
  const handleTextSelection = (text: string) => {
    console.log('PresentationViewer: Text selected:', text);
    console.log('PresentationViewer: onTextSelect prop is', onTextSelect ? 'provided' : 'not provided');
    
    if (text && onTextSelect) {
      const cleanText = cleanSelectedText(text);
      console.log('PresentationViewer: Clean text:', cleanText);
      
      if (cleanText) {
        console.log('PresentationViewer: Calling onTextSelect with clean text');
        onTextSelect(cleanText);
      } else {
        console.log('PresentationViewer: Clean text is empty, not calling onTextSelect');
      }
    } else {
      console.log('PresentationViewer: Text empty or onTextSelect not provided');
    }
  };
  
  // Clear selected text when changing presentations
  useEffect(() => {
    setSelectedText('');
  }, [presentationData?.id]);

  // Function to reset the presentation
  const resetPresentation = () => {
    setPresentationData(null);
    setUploadProgress(0);
    setError(null);
    setIsLoading(false);
    setUploading(false);
    setUploadError(null);
    setIframeError(null);
    setUploadStage('idle');
    setUploadMessage('Uploading file...');
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    // If parent component provided onReset callback, call it
    onReset?.();
  };

  // Expose the resetPresentation method to parent components
  useImperativeHandle(ref, () => ({
    resetPresentation
  }));

  return (
    <div className={`w-full h-full flex flex-col transform-gpu backface-visibility-hidden ${className} ${activeTab === 'chat' ? 'h-48 transition-all duration-300' : ''}`}>
      {/* File Upload UI */}
      {!presentationData ? (
        // Upload Area
        <label 
          htmlFor="file-upload"
          className={`h-full flex flex-col items-center justify-center gap-2 p-6 bg-white/80 backdrop-blur-xl shadow-sm hover:bg-white/90 transition-all duration-300 cursor-pointer relative ${activeTab === 'chat' ? 'h-48' : ''}`}
        >
          {uploadError ? (
            <div className="text-red-500 text-xl mb-4">{uploadError}</div>
          ) : uploading || isLoading ? (
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
            <>
              <Upload className={`${activeTab === 'chat' ? 'w-5 h-5' : 'w-8 h-8'} text-blue-600 stroke-[1.5]`} />
              <span className={`${activeTab === 'chat' ? 'text-[13px]' : 'text-[15px]'} text-gray-900 font-medium tracking-tight text-center`}>
                Upload Document
              </span>
              <p className={`${activeTab === 'chat' ? 'text-[11px]' : 'text-xs'} text-gray-500 text-center`}>
                Supported formats: PowerPoint, Word, PDF
              </p>
            </>
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
        <div className={`flex flex-col flex-grow h-full transition-all duration-300 ${activeTab === 'chat' ? 'h-48' : ''}`}>
          {/* Document viewer only - no sidebar */}
          <div className={`flex-grow h-full w-full document-viewer-area relative transition-all duration-300 ${activeTab === 'chat' ? 'h-48' : ''}`}>
            {presentationData.type === 'pdf' ? (
              <PDFViewer 
                url={presentationData.url} 
                apiUrl={presentationData.apiUrl}
                filename={presentationData.filename}
                onTextSelect={handlePDFTextSelection}
                onDocumentTextExtracted={onDocumentTextExtracted}
                defaultZoom={activeTab === 'chat' ? 0.5 : 0.7}
              />
            ) : presentationData.type === 'powerpoint' ? (
              <PowerPointViewer 
                url={presentationData.url} 
                filename={presentationData.filename}
                onTextSelect={handleTextSelection}
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
        <div className={`absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-md ${activeTab === 'chat' ? 'scale-75' : ''}`}>
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

export default PresentationViewer; 