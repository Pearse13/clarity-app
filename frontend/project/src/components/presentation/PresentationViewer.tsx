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

          if (!responseData.url) {
            throw new Error('No URL returned from server');
          }

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

  const handleIframeLoad = (event: React.SyntheticEvent<HTMLIFrameElement>) => {
    console.log('iframe loaded');
    const iframe = event.target as HTMLIFrameElement;
    
    // Delay setting loading to false to ensure content is rendered
    setTimeout(() => {
      setIframeLoading(false);
      setIframeError(null);
      setRetryCount(0);
    }, 500);
    
    // Add a message listener for communication with the iframe content
    window.addEventListener('message', (event) => {
      // Verify the origin of the message
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'textSelection') {
        const cleanText = cleanSelectedText(event.data.text);
        if (cleanText && onTextSelect) {
          onTextSelect(cleanText);
        }
      }
    });
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
    
    // Force iframe reload by updating the URL with a timestamp
    const timestamp = new Date().getTime();
    const url = new URL(presentation.url, window.location.origin);
    url.searchParams.set('t', timestamp.toString());
    
    // Update the iframe src
    const iframe = document.querySelector('iframe');
    if (iframe) {
      iframe.src = url.toString();
    }
  }, [presentation, retryCount]);

  return (
    <div className="h-full">
      {presentation ? (
        // Presentation Viewer
        <div className="w-full h-full p-4">
          <div className="mb-4 flex justify-between items-center">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setPresentation(null);
                  setIframeError(null);
                  setRetryCount(0);
                  setIframeLoading(false);
                }}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Upload Another
              </button>
              {iframeError && (
                <button
                  onClick={retryLoad}
                  disabled={retryCount >= 3}
                  className={`px-4 py-2 text-sm rounded-lg flex items-center gap-2 ${
                    retryCount >= 3
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </button>
              )}
            </div>
            {iframeError && (
              <p className="text-sm text-red-500">
                {iframeError}
                {retryCount >= 3 ? ' (Max retries reached)' : ''}
              </p>
            )}
          </div>
          {iframeLoading && (
            <div className="w-full h-[calc(100%-60px)] flex items-center justify-center bg-white rounded-xl">
              <div className="flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
                <p className="text-gray-500">Loading file preview...</p>
                <p className="text-sm text-gray-400">This may take a few moments</p>
              </div>
            </div>
          )}
          <iframe
            src={presentation.url}
            className={`w-full h-[calc(100%-60px)] border-0 rounded-xl shadow-sm bg-white transition-opacity duration-300 ${
              iframeLoading ? 'opacity-0' : 'opacity-100'
            }`}
            title={presentation.filename}
            sandbox="allow-same-origin allow-scripts allow-popups allow-modals allow-downloads allow-forms allow-presentation"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            style={{ pointerEvents: 'all' }}
            referrerPolicy="origin"
            allow="fullscreen"
            loading="lazy"
          />
        </div>
      ) : (
        // Upload Area
        <label 
          htmlFor="file-upload"
          className={`
            h-full flex flex-col items-center justify-center gap-4 p-6
            ${uploading ? 'bg-blue-50' : 'bg-white/80'} 
            backdrop-blur-xl shadow-sm hover:bg-white/90 
            transition-colors cursor-pointer relative
          `}
        >
          {error ? (
            <AlertCircle className="w-8 h-8 text-red-500 stroke-[1.5]" />
          ) : uploading ? (
            <>
              <RefreshCw className="w-8 h-8 text-blue-600 stroke-[1.5] animate-spin" />
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-100">
                <div 
                  className="h-full bg-blue-600 transition-all duration-150"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </>
          ) : (
            <Upload className="w-8 h-8 text-blue-600 stroke-[1.5]" />
          )}
          <span className="text-[15px] text-gray-900 font-medium tracking-tight">
            {uploading ? `Uploading... ${Math.round(uploadProgress)}%` : 'Upload Document'}
          </span>
          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}
          <p className="text-xs text-gray-500">
            Supported formats: PowerPoint, Word, PDF
          </p>
          <input 
            id="file-upload" 
            type="file"
            accept=".ppt,.pptx,.doc,.docx,.pdf"
            className="hidden" 
            onChange={handleFileUpload}
            disabled={uploading}
          />
        </label>
      )}
    </div>
  );
}

export default PresentationViewer; 