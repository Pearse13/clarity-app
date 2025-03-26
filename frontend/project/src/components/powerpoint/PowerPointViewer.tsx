import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

export type PowerPointViewerProps = {
  url: string;
  apiUrl?: string;
  filename: string;
  onTextSelect?: (text: string) => void;
};

export const PowerPointViewer: React.FC<PowerPointViewerProps> = ({ url, apiUrl, filename, onTextSelect }) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [iframeHeight, setIframeHeight] = useState<number>(600);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // Force refresh the iframe when retry is clicked
  const refreshKey = `${apiUrl}-${retryCount}-${Date.now()}`;

  // Create direct iframe URL - simplest approach
  const getDirectUrl = () => {
    if (!apiUrl) return url;
    
    // Make sure we use HTTPS URLs
    return apiUrl.replace('http://', 'https://');
  };
  
  // Create Office Online Viewer URL
  const getOfficeViewerUrl = () => {
    if (!apiUrl) return url;
    
    // Make sure we use HTTPS URLs
    const secureApiUrl = apiUrl.replace('http://', 'https://');
    
    // Add cache buster to URL
    const urlWithCacheBuster = `${secureApiUrl}?t=${Date.now()}`;
    console.log('Using Office Online Viewer with URL:', urlWithCacheBuster);
    
    const encodedFileUrl = encodeURIComponent(urlWithCacheBuster);
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodedFileUrl}&wdStartOn=1&wdEmbedCode=0&wdAr=1.3333&wdPrint=0`;
  };
  
  // We'll use the Office viewer by default (no Google viewer)
  const [useDirectViewer, setUseDirectViewer] = useState<boolean>(true); // Changed to true to prefer direct viewer
  
  // Get the current viewer URL based on the state
  const getCurrentViewerUrl = () => {
    return useDirectViewer ? getDirectUrl() : getOfficeViewerUrl();
  };
  
  // Refresh the viewer and optionally toggle between viewers
  const retryLoad = (toggleViewer = false) => {
    setIsLoading(true);
    setError(null);
    
    if (toggleViewer) {
      setUseDirectViewer(!useDirectViewer);
      console.log(`Switching to ${!useDirectViewer ? 'Direct' : 'Microsoft Office'} viewer`);
    }
    
    setRetryCount(prev => prev + 1);
  };

  // Handle messages from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify origin for security
      const allowedOrigins = [
        window.location.origin,
        'https://clarity-backend-production.up.railway.app'
      ];
      
      if (!allowedOrigins.includes(event.origin)) {
        console.warn('Received message from unauthorized origin:', event.origin);
        return;
      }

      // Handle height updates
      if (event.data.type === 'resize') {
        const newHeight = event.data.height;
        if (typeof newHeight === 'number' && newHeight > 0) {
          console.log('Updating iframe height to:', newHeight);
          setIframeHeight(newHeight);
        }
      }

      // Handle text selection
      if (event.data.type === 'textSelection' && onTextSelect) {
        onTextSelect(event.data.text);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onTextSelect]);

  // Inject height calculation script into iframe after load
  const injectHeightScript = () => {
    if (!iframeRef.current) return;
    
    try {
      const iframe = iframeRef.current;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      
      if (!iframeDoc) {
        console.warn('Could not access iframe document');
        return;
      }

      // Add script to calculate and send height
      const script = iframeDoc.createElement('script');
      script.textContent = `
        function updateHeight() {
          const height = Math.max(
            document.documentElement.scrollHeight,
            document.body.scrollHeight
          );
          window.parent.postMessage({ type: 'resize', height }, '*');
        }

        // Update height on load and when content changes
        window.addEventListener('load', updateHeight);
        window.addEventListener('resize', updateHeight);
        
        // Create observer to watch for DOM changes
        const observer = new MutationObserver(updateHeight);
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true
        });

        // Initial height calculation
        updateHeight();
      `;

      iframeDoc.body.appendChild(script);
    } catch (error) {
      console.error('Error injecting height script:', error);
    }
  };
  
  return (
    <div className="w-full flex flex-col relative transform-gpu backface-visibility-hidden">
      {/* Viewer type indicator */}
      <div className="px-8 py-3 bg-blue-50 border-b border-blue-100 text-blue-800 text-sm flex justify-between items-center">
        <span>Using {useDirectViewer ? 'Direct' : 'Microsoft Office Online'} viewer</span>
        <button 
          onClick={() => retryLoad(true)} 
          className="text-blue-600 hover:text-blue-800 px-3 py-1 rounded-md hover:bg-blue-100 transition-colors"
        >
          Try {useDirectViewer ? 'Microsoft Office Online' : 'Direct'} viewer
        </button>
      </div>
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-10">
          <div className="animate-spin rounded-full h-16 w-16 border-t-3 border-b-3 border-blue-500 mb-6"></div>
          <p className="text-gray-600 text-lg mb-2">Loading PowerPoint presentation...</p>
          <p className="text-sm text-gray-500">This may take a few moments for large files</p>
          {retryCount > 0 && (
            <p className="mt-3 text-xs text-gray-400">Retry attempt: {retryCount}</p>
          )}
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-20 p-4">
          <p className="text-red-500 mb-4">{error}</p>
          <div className="flex gap-2">
            <button
              onClick={() => retryLoad(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try {useDirectViewer ? 'Microsoft Office' : 'Direct'} Viewer
            </button>
            
            <button
              onClick={() => retryLoad(false)}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center justify-center"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry Current Viewer
            </button>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            If viewing continues to fail, please try using the alternate viewer.
          </p>
        </div>
      )}
      
      {/* PowerPoint Viewer iframe */}
      <iframe
        ref={iframeRef}
        key={refreshKey}
        src={getCurrentViewerUrl()}
        className="w-full transform-gpu"
        style={{ 
          border: 'none', 
          willChange: 'transform',
          height: `${iframeHeight}px`,
          transition: 'height 0.3s ease'
        }}
        onLoad={() => {
          console.log(`${useDirectViewer ? 'Direct' : 'Microsoft Office'} PowerPoint viewer loaded successfully`);
          setIsLoading(false);
          setError(null);
          if (useDirectViewer) {
            injectHeightScript();
          }
        }}
        onError={(e) => {
          console.error(`${useDirectViewer ? 'Direct' : 'Microsoft Office'} PowerPoint viewer failed to load:`, e);
          setError(`Failed to load PowerPoint with ${useDirectViewer ? 'Direct' : 'Microsoft Office'} viewer. Try the alternate viewer.`);
          setIsLoading(false);
        }}
        sandbox="allow-scripts allow-same-origin allow-forms"
        referrerPolicy="no-referrer"
        title="PowerPoint Presentation"
      />
    </div>
  );
};

export default PowerPointViewer; 