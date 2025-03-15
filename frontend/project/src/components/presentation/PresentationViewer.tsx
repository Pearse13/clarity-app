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
  url: string;
  filename: string;
  document_id?: string; // Optional document_id field
  apiUrl?: string; // Optional API URL as fallback
}

interface PresentationViewerProps {
  onTextSelect?: (text: string) => void;
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
      setRetryCount(0);

      const formData = new FormData();
      formData.append('file', file);

      console.log('Starting file upload...', {
        filename: file.name,
        size: file.size,
        type: file.type
      });

      // Add retry logic for connection issues
      const maxRetries = 3;
      let retryCount = 0;
      let lastError = null;

      while (retryCount < maxRetries) {
        try {
          // Force using the production URL
          const apiUrl = 'https://clarity-backend-production.up.railway.app';
          console.log('Using API URL for upload:', apiUrl);
          
          const response = await fetch(`${apiUrl}/api/presentations/upload`, {
            method: 'POST',
            body: formData,
            headers: {
              'Accept': 'application/json',
              'Origin': window.location.origin
            },
            credentials: 'include',
            mode: 'cors'
          });

          console.log('Response status:', response.status);
          console.log('Response headers:', Object.fromEntries(response.headers.entries()));

          const responseText = await response.text();
          console.log('Raw response:', responseText);

          let responseData;
          try {
            responseData = JSON.parse(responseText);
          } catch (e) {
            console.error('Error parsing JSON response:', e);
            throw new Error(`Invalid JSON response: ${responseText}`);
          }

          if (!response.ok) {
            throw new Error(responseData.detail || 'Failed to upload file');
          }

          if (responseData.error) {
            throw new Error(responseData.error);
          }

          // Check if we need to poll for status
          if (responseData.status === "processing" && responseData.check_status_url) {
            console.log('Document is processing, checking status...');
            
            // Poll for status until complete or max attempts reached
            let statusCheckCount = 0;
            const maxStatusChecks = 10;
            
            while (statusCheckCount < maxStatusChecks) {
              console.log(`Status check attempt ${statusCheckCount + 1} of ${maxStatusChecks}`);
              
              // Wait before checking status
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              // Check document status
              try {
                const statusResponse = await fetch(`${apiUrl}${responseData.check_status_url}`, {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Origin': window.location.origin
                  },
                  credentials: 'include',
                  mode: 'cors'
                });
                
                console.log('Status check response status:', statusResponse.status);
                console.log('Status check response headers:', Object.fromEntries(statusResponse.headers.entries()));
                
                if (!statusResponse.ok) {
                  console.error('Status check failed with status:', statusResponse.status);
                  throw new Error(`Status check failed with status: ${statusResponse.status}`);
                }
                
                const statusText = await statusResponse.text();
                console.log('Status check raw response:', statusText);
                
                let statusData;
                try {
                  statusData = JSON.parse(statusText);
                } catch (e) {
                  console.error('Error parsing status JSON response:', e);
                  throw new Error(`Invalid JSON in status response: ${statusText}`);
                }
                
                console.log('Status check response:', statusData);
                
                // Check if document is complete (handle both 'complete' and 'completed' status)
                if ((statusData.status === "complete" || statusData.status === "completed") && 
                    (statusData.url || (statusData.files && Object.keys(statusData.files).length > 0))) {
                  // Document is ready
                  console.log('Document processing complete');
                  
                  // Get URL from response (either direct url or from files object)
                  let documentUrl = statusData.url;
                  
                  // If no direct URL but files are available, use the first file
                  if (!documentUrl && statusData.files) {
                    const fileKeys = Object.keys(statusData.files);
                    if (fileKeys.length > 0) {
                      const firstFileKey = fileKeys[0];
                      // Use the path provided in the response if available
                      documentUrl = statusData.files[firstFileKey];
                      // If it's a string, use it directly
                      if (typeof documentUrl === 'string') {
                        console.log('Using file URL from string:', documentUrl);
                      } 
                      // If it's an object with a url property, use that
                      else if (documentUrl && typeof documentUrl === 'object' && 'url' in documentUrl) {
                        documentUrl = documentUrl.url;
                        console.log('Using file URL from object:', documentUrl);
                      }
                      // Fallback to constructing a path
                      else {
                        documentUrl = `/static/presentations/${statusData.document_id}/${firstFileKey}`;
                        console.log('Using file URL from fallback path:', documentUrl);
                      }
                    }
                  }
                  
                  if (!documentUrl) {
                    throw new Error('No document URL found in response');
                  }
                  
                  // Try the static file path first, as it's more likely to work
                  const fullUrl = `${apiUrl}/static/presentations/${statusData.document_id}/presentation.pdf`;
                  console.log('Using static file path:', fullUrl);
                  
                  // Store the API URL as a fallback
                  const apiEndpointUrl = documentUrl.startsWith('http') 
                    ? documentUrl 
                    : `${apiUrl}${documentUrl}`;
                  console.log('API endpoint URL (fallback):', apiEndpointUrl);
                  
                  // Set the URL in the response data
                  responseData.url = fullUrl;
                  responseData.apiUrl = apiEndpointUrl; // Store the API URL as a fallback
                  
                  // Store the document_id for future use
                  responseData.document_id = statusData.document_id;
                  
                  // Set progress to 100% when processing is complete
                  setUploadProgress(100);
                  setPresentation(responseData);
                  setIframeLoading(true);
                  return; // Success, exit the retry loop
                } else if (statusData.status === "error") {
                  throw new Error(statusData.error || 'Error processing document');
                }
              } catch (statusErr) {
                console.error('Error checking document status:', statusErr);
                
                // Fallback: Try to construct a URL directly based on document_id
                console.log('Status check failed, trying fallback URL construction');
                
                // Wait a bit to give the backend time to process
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                // Construct a fallback URL
                const fallbackUrl = `${apiUrl}/static/presentations/${responseData.document_id}/document.pdf`;
                console.log('Using fallback URL:', fallbackUrl);
                
                // Set the URL and continue
                responseData.url = fallbackUrl;
                setUploadProgress(100);
                setPresentation(responseData);
                setIframeLoading(true);
                return; // Exit the retry loop
              }
              
              statusCheckCount++;
            }
            
            throw new Error('Document processing timed out');
          } else if (responseData.url) {
            // Direct URL available (no processing needed)
            console.log('Parsed response data:', responseData);

            // Construct full URL for the presentation
            const fullUrl = `${apiUrl}${responseData.url}`;
            console.log('Full URL:', fullUrl);
            responseData.url = fullUrl;

            // Set progress to 100% when upload is actually complete
            setUploadProgress(100);
            setPresentation(responseData);
            setIframeLoading(true);
            return; // Success, exit the retry loop
          } else {
            throw new Error('No URL or status check URL returned from server');
          }
        } catch (err) {
          lastError = err;
          retryCount++;
          if (retryCount < maxRetries) {
            console.log(`Retry attempt ${retryCount} of ${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
          }
        }
      }

      // If we get here, all retries failed
      throw lastError;
      
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

  const retryLoad = useCallback(() => {
    if (!presentation || retryCount >= 3) {
      setIframeError('Failed to load file preview after multiple attempts');
      setIframeLoading(false);
      return;
    }
    
    console.log('Retrying iframe load...');
    setIframeLoading(true);
    setIframeError(null);
    setRetryCount(prev => prev + 1);
    
    // Try different URL formats based on retry count
    const apiUrl = 'https://clarity-backend-production.up.railway.app';
    const docId = presentation.document_id || presentation.url.split('/').slice(-2)[0]; // Extract document ID from URL or use document_id if available
    
    let newUrl;
    if (retryCount === 0 && presentation.apiUrl) {
      // Try the API endpoint URL if available
      newUrl = presentation.apiUrl;
      console.log('Trying API endpoint URL:', newUrl);
    } else if (retryCount === 0 || retryCount === 1) {
      // Try the static file path format
      newUrl = `${apiUrl}/static/presentations/${docId}/presentation.pdf`;
      console.log('Trying static file path format:', newUrl);
    } else {
      // Try another static path format
      newUrl = `${apiUrl}/static/presentations/${docId}/document.pdf`;
      console.log('Trying alternative static path format:', newUrl);
    }
    
    // Update the presentation URL
    setPresentation(prev => {
      if (!prev) return null;
      return { ...prev, url: newUrl };
    });
  }, [presentation, retryCount]);

  // Add a function to handle iframe load with URL checking
  const handleIframeLoadWithCheck = useCallback(async (event: React.SyntheticEvent<HTMLIFrameElement>) => {
    console.log('iframe loaded or attempted to load');
    const iframe = event.target as HTMLIFrameElement;
    
    // Check if the iframe content is accessible
    try {
      // Try to access the contentDocument to see if it loaded successfully
      if (iframe.contentDocument) {
        console.log('iframe content loaded successfully');
        
        // Delay setting loading to false to ensure content is rendered
        setTimeout(() => {
          setIframeLoading(false);
          setIframeError(null);
          setRetryCount(0);
        }, 500);
        
        return;
      }
    } catch (err) {
      // If we can't access the contentDocument, it might be due to CORS
      console.warn('Could not access iframe content, possibly due to CORS:', err);
    }
    
    // If we get here, the iframe might have loaded but with an error page
    // Check if the URL is accessible
    const isAccessible = await checkUrlAccessible(presentation?.url || '');
    
    if (!isAccessible) {
      console.log('URL is not accessible, retrying with a different format');
      retryLoad();
    } else {
      // URL is accessible but iframe might still have issues
      // Set loading to false anyway
      setTimeout(() => {
        setIframeLoading(false);
      }, 500);
    }
  }, [presentation, retryLoad]);

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
    
    // Try a different URL format if this is the first error
    if (retryCount === 0) {
      retryLoad();
    }
  };

  const handleIframeError = (event: React.SyntheticEvent<HTMLIFrameElement>) => {
    console.error('iframe error:', event);
    setIframeError('Failed to load file preview');
    setIframeLoading(false);
    
    // Only retry if we haven't exceeded max retries
    if (retryCount < 3) {
      retryLoad();
    }
  };

  return (
    <div className="h-full">
      {presentation ? (
        // Presentation Viewer
        <div className="flex flex-col h-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Presentation Viewer</h2>
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
              <p className="mt-2 text-xs text-gray-500">URL: {presentation.url}</p>
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
              <div className="mt-4 flex gap-2">
                <button
                  onClick={retryLoad}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
                <a 
                  href={presentation.url} 
                  download={`presentation-${new Date().toISOString().split('T')[0]}.pdf`}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Download File
                </a>
              </div>
            </div>
          )}

          {!iframeLoading && !iframeError && (
            <div className="flex-grow border rounded-lg overflow-hidden">
              <iframe
                src={presentation.url}
                className="w-full h-full"
                title="Presentation Viewer"
                onLoad={handleIframeLoadWithCheck}
                onError={handleIframeError}
                style={{ pointerEvents: 'all' }}
                referrerPolicy="origin"
                allow="fullscreen"
                loading="lazy"
              ></iframe>
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