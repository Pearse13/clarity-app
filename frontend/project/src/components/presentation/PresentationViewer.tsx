import React, { useState, useCallback, useEffect } from 'react';
import { Upload, AlertCircle, RefreshCw } from 'lucide-react';

// Debug log for environment variables
console.log('Environment variables:', {
  VITE_ENV: import.meta.env.VITE_ENV,
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_PRODUCTION_API_URL: import.meta.env.VITE_PRODUCTION_API_URL
});

interface UploadResponse {
  id: string;
  document_id?: string;
  status: 'ready' | 'processing' | 'error';
  url: string;
  filename: string;
  type: string;
  alternativeUrl?: string;
  error?: string;
  check_status_url?: string;
  apiUrl?: string;
  isPowerPoint?: boolean;
  useDirectViewer?: boolean;
  possibleUrls?: string[];
}

interface PresentationViewerProps {
  onTextSelect?: (text: string) => void;
}

interface ViewerUrls {
  office: string;
  google: string;
}

interface FileStatusResponse {
  document_id: string;
  status: 'ready' | 'processing' | 'error';
  error?: string;
  filename?: string;
  type?: string;
  original_path?: string;
  url?: string;
  check_status_url?: string;
  file_url?: string;  // Optional since older responses might not have it
}

const SUPPORTED_FILE_TYPES = {
  '.ppt': 'PowerPoint',
  '.pptx': 'PowerPoint',
  '.doc': 'Word',
  '.docx': 'Word',
  '.pdf': 'PDF'
};

export function PresentationViewer({ onTextSelect }: PresentationViewerProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [presentation, setPresentation] = useState<UploadResponse | null>(null);
  const [iframeLoading, setIframeLoading] = useState(false);
  const [iframeError, setIframeError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [viewerUrls, setViewerUrls] = useState<ViewerUrls>({ office: '', google: '' });
  const [activeViewer, setActiveViewer] = useState<'office' | 'google'>('office');
  const apiUrl = process.env.VITE_PRODUCTION_API_URL || 'https://clarity-backend-production.up.railway.app';

  // Check if the backend API is accessible
  useEffect(() => {
    const checkBackendAccess = async () => {
      try {
        const apiUrl = 'https://clarity-backend-production.up.railway.app';
        console.log('Checking backend API access at:', apiUrl);
        
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
        } else {
          console.error('Backend API health check failed with status:', response.status);
        }
      } catch (err) {
        console.error('Error checking backend API access:', err);
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

  // Handle text selection in the iframe
  const handleTextSelection = useCallback(() => {
    const iframe = document.querySelector('iframe');
    if (!iframe) {
      console.log('No iframe found');
      return;
    }

    try {
      // Try to get the selection from the iframe's content window
      const iframeWindow = iframe.contentWindow;
      if (!iframeWindow) {
        console.log('No iframe window access');
        return;
      }

      // Get selection from iframe document
      const iframeDoc = iframeWindow.document;
      if (!iframeDoc) {
        console.log('No iframe document access');
        return;
      }

      // Get selection from iframe or main window
      const selection = iframeDoc.getSelection() || window.getSelection();
      const rawText = selection?.toString() || '';
      
      console.log('Raw selected text:', rawText); // Debug log
      
      if (rawText && onTextSelect) {
        const cleanText = cleanSelectedText(rawText);
        console.log('Cleaned selected text:', cleanText); // Debug log
        if (cleanText) {
          onTextSelect(cleanText);
        }
      }
    } catch (err) {
      // If we can't access the iframe selection, try getting it from the main window
      const mainSelection = window.getSelection();
      const rawText = mainSelection?.toString() || '';
      
      console.log('Fallback - Raw selected text:', rawText); // Debug log
      
      if (rawText && onTextSelect) {
        const cleanText = cleanSelectedText(rawText);
        console.log('Fallback - Cleaned selected text:', cleanText); // Debug log
        if (cleanText) {
          onTextSelect(cleanText);
        }
      }
    }
  }, [onTextSelect, cleanSelectedText]);

  // Add event listeners for text selection
  useEffect(() => {
    const iframe = document.querySelector('iframe');
    
    const addListeners = () => {
      try {
        if (iframe?.contentDocument) {
          // Add listeners to the iframe document
          iframe.contentDocument.addEventListener('mouseup', handleTextSelection);
          iframe.contentDocument.addEventListener('keyup', handleTextSelection);
          iframe.contentDocument.addEventListener('selectionchange', handleTextSelection);
          
          // Also add listeners to any body element that might be added later
          const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              if (mutation.type === 'childList') {
                const body = iframe.contentDocument?.body;
                if (body) {
                  body.addEventListener('mouseup', handleTextSelection);
                  body.addEventListener('keyup', handleTextSelection);
                  body.addEventListener('selectionchange', handleTextSelection);
                }
              }
            });
          });
          
          observer.observe(iframe.contentDocument, {
            childList: true,
            subtree: true
          });
        }
        
        // Also listen on main window and iframe element
        document.addEventListener('mouseup', handleTextSelection);
        document.addEventListener('keyup', handleTextSelection);
        document.addEventListener('selectionchange', handleTextSelection);
        iframe?.addEventListener('mouseup', handleTextSelection);
        iframe?.addEventListener('keyup', handleTextSelection);
      } catch (err) {
        console.warn('Error adding event listeners:', err);
      }
    };

    if (iframe) {
      // Add listeners when iframe loads
      iframe.addEventListener('load', () => {
        // Small delay to ensure content is loaded
        setTimeout(addListeners, 1000);
      });
      // Try adding listeners immediately as well
      addListeners();
    }

    return () => {
      try {
        if (iframe?.contentDocument) {
          iframe.contentDocument.removeEventListener('mouseup', handleTextSelection);
          iframe.contentDocument.removeEventListener('keyup', handleTextSelection);
          iframe.contentDocument.removeEventListener('selectionchange', handleTextSelection);
          
          const body = iframe.contentDocument.body;
          if (body) {
            body.removeEventListener('mouseup', handleTextSelection);
            body.removeEventListener('keyup', handleTextSelection);
            body.removeEventListener('selectionchange', handleTextSelection);
          }
        }
        document.removeEventListener('mouseup', handleTextSelection);
        document.removeEventListener('keyup', handleTextSelection);
        document.removeEventListener('selectionchange', handleTextSelection);
        iframe?.removeEventListener('mouseup', handleTextSelection);
        iframe?.removeEventListener('keyup', handleTextSelection);
      } catch (err) {
        console.warn('Error removing event listeners:', err);
      }
    };
  }, [handleTextSelection]);

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
      setUploadProgress(0);
      setError(null);
      setIframeError(null);

      const formData = new FormData();
      formData.append('file', file);

      console.log('Starting file upload...', {
        filename: file.name,
        size: file.size,
        type: file.type
      });

      // Use the production API URL
          const apiUrl = 'https://clarity-backend-production.up.railway.app';
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

          if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${errorText}`);
      }

      const responseData = await response.json();
      console.log('Upload response:', responseData);

      if (!responseData.document_id) {
        throw new Error('No document ID received from server');
      }

      // Handle PowerPoint files
      if (file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
          file.type === 'application/vnd.ms-powerpoint') {
        
        console.log('PowerPoint file uploaded, setting up viewer...');
        
        // Set up PowerPoint viewing with the response data
        await setupPowerPointViewing(responseData);
        
        return;
      }

      // Handle PDF files
                  if (file.type === 'application/pdf') {
        console.log('PDF file uploaded, displaying directly');
        
        const docId = responseData.document_id;
        const filename = `${docId}.pdf`;
        const pdfUrl = `${apiUrl}/api/presentations/documents/${docId}/${filename}`;
        
        const presentationData: UploadResponse = {
          id: docId,
          document_id: docId,
          status: 'ready',
          url: pdfUrl,
                      filename: file.name,
          type: 'PDF',
          apiUrl: pdfUrl
                    };
                    
                    setUploadProgress(100);
        setPresentation(presentationData);
                    setIframeLoading(true);
        return;
      }
      
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
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

  const retryLoad = useCallback(async () => {
    if (!presentation) {
      setIframeError('No presentation to reload');
      return;
    }
    
    console.log('Retrying PDF load...');
    setIframeLoading(true);
    setIframeError(null);
    
    // Simply reload the current URL
    setPresentation(prev => {
      if (!prev) return null;
      // Force a refresh by creating a new URL object with the same source
      const refreshedUrl = prev.url.includes('blob:') 
        ? prev.url  // Keep blob URLs as they are
        : `${prev.url}${prev.url.includes('?') ? '&' : '?'}refresh=${Date.now()}`;
      return { ...prev, url: refreshedUrl };
    });
  }, [presentation]);

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
        const response = await fetch(statusUrl);
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
        console.log('Setting up PowerPoint viewing...');
        setIframeLoading(true);
        setIframeError(null);
        
        // Use the direct file URL from the upload response without modification
        if (!fileData.file_url) {
            throw new Error('No file URL provided in the response');
        }
        
        const fileUrl = fileData.file_url;
        console.log('File URL:', fileUrl);

        // Create Office Online Viewer URL with additional parameters for better reliability
        const encodedFileUrl = encodeURIComponent(fileUrl);
        const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodedFileUrl}&wdStartOn=1&wdEmbedCode=0&wdAr=1.3333&wdPrint=0&wdModified=${Date.now()}`;

        console.log('Created Office viewer URL:', officeViewerUrl);

        // Set the viewer URLs
        setViewerUrls({
            office: officeViewerUrl,
            google: ''
        });

        // Set active viewer
        setActiveViewer('office');

        // Create presentation data
        const presentationData: UploadResponse = {
            id: fileData.document_id,
            document_id: fileData.document_id,
            status: 'ready',
            url: officeViewerUrl,
            filename: fileData.filename || 'presentation.pptx',
            type: 'PowerPoint',
            isPowerPoint: true,
            apiUrl: fileUrl
        };

        // Set the presentation data
        setPresentation(presentationData);
        console.log('PowerPoint viewer setup complete');

        // Start a timeout to check if the viewer loads
        const timeoutId = setTimeout(() => {
            const iframe = document.querySelector('iframe');
            if (iframe && !iframe.contentWindow?.document?.body) {
                console.log('Viewer failed to load within timeout');
                setIframeError('The PowerPoint viewer is taking longer than expected. Please try refreshing the page.');
                setIframeLoading(false);
            }
        }, 30000); // 30 second timeout

        return () => clearTimeout(timeoutId);
    } catch (error) {
        console.error('Error setting up PowerPoint viewing:', error);
        setIframeLoading(false);
        setIframeError('Failed to set up PowerPoint viewer. Please try refreshing the page.');
        throw error;
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

  return (
    <div className="h-full">
      {presentation ? (
        // Presentation Viewer
        <div className="flex flex-col h-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">
              {presentation.filename}
            </h2>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setPresentation(null);
                  setIframeError(null);
                  setRetryCount(0);
                  setIframeLoading(false);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Upload Another
              </button>
            </div>
          </div>

          {iframeLoading && (
            <div className="flex flex-col items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              <p className="mt-4 text-gray-600">Loading your file...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              <p>{error}</p>
            </div>
          )}

          {iframeError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              <p>{iframeError}</p>
              <p className="text-sm mt-2">The file was uploaded successfully, but there was an issue displaying it in the browser.</p>
              <div className="mt-4 flex space-x-2">
                <button
                  onClick={retryLoad}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh Viewer
                </button>
              </div>
            </div>
          )}

          {!iframeLoading && !iframeError && (
            <div className="flex-grow border rounded-lg overflow-hidden bg-white">
              {presentation.isPowerPoint ? (
                <div className="w-full h-full flex flex-col">
                  <div className="flex-grow relative min-h-[600px] bg-gray-50">
                    {iframeLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-10">
                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                            <p className="mt-4 text-gray-600">Loading PowerPoint presentation...</p>
                            <p className="mt-2 text-sm text-gray-500">This may take a few moments for large files</p>
                            <button
                                onClick={retryLoad}
                                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Refresh Viewer
                            </button>
                        </div>
                    )}
                    <iframe
                      key={viewerUrls.office + Date.now()} // Force iframe refresh
                      src={viewerUrls.office}
                      className="w-full h-full absolute inset-0"
                      style={{ border: 'none' }}
                      onLoad={() => {
                        console.log('PowerPoint viewer loaded successfully');
                        setIframeLoading(false);
                        setIframeError(null);
                      }}
                      onError={(e) => {
                        console.error('PowerPoint viewer failed to load:', e);
                        setIframeError('Failed to load PowerPoint. Please try refreshing the page.');
                        setIframeLoading(false);
                      }}
                      allow="fullscreen"
                      title="PowerPoint Presentation"
                    />
                  </div>
                </div>
              ) : (
                // For PDFs, use direct embed
                <iframe
                  src={presentation.url}
                  className="w-full h-full min-h-[600px]"
                  onLoad={() => {
                    console.log('PDF loaded successfully');
                    setIframeLoading(false);
                  }}
                  onError={() => {
                    console.log('PDF failed to load');
                    setIframeError('Failed to load PDF. Please try again.');
                    setIframeLoading(false);
                  }}
                />
              )}
            </div>
          )}
        </div>
      ) : (
        // Upload Area
        <label 
          htmlFor="file-upload"
          className="h-full flex flex-col items-center justify-center gap-4 p-6 bg-white/80 backdrop-blur-xl shadow-sm hover:bg-white/90 transition-colors cursor-pointer relative"
        >
          {error ? (
            <div className="text-red-500 text-xl mb-4">{error}</div>
          ) : uploading ? (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              <p className="mt-4 text-gray-600">Processing your file...</p>
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-100">
                <div 
                  className="h-full bg-blue-600 transition-all duration-150"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <Upload className="w-8 h-8 text-blue-600 stroke-[1.5]" />
              <span className="text-[15px] text-gray-900 font-medium tracking-tight">
                Upload Document
              </span>
              <p className="text-xs text-gray-500">
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
            disabled={uploading}
          />
        </label>
      )}
    </div>
  );
}

export default PresentationViewer; 