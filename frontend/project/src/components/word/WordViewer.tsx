import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

export type WordViewerProps = {
  url: string;
  apiUrl?: string;
  filename: string;
  onTextSelect?: (text: string) => void;
};

export const WordViewer: React.FC<WordViewerProps> = ({ url, apiUrl, filename, onTextSelect }) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  
  // Force refresh the iframe when retry is clicked
  const refreshKey = `${apiUrl}-${retryCount}-${Date.now()}`;

  // Create Office Online Viewer URL
  const getOfficeViewerUrl = () => {
    if (!apiUrl) return url;
    
    // Make sure we use HTTPS URLs
    const secureApiUrl = apiUrl.replace('http://', 'https://');
    
    // Add cache buster to URL
    const urlWithCacheBuster = `${secureApiUrl}?t=${Date.now()}`;
    console.log('Using Office Online Viewer with URL:', urlWithCacheBuster);
    
    const encodedFileUrl = encodeURIComponent(urlWithCacheBuster);
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodedFileUrl}&wdStartOn=1&wdEmbedCode=0`;
  };
  
  // Create PDF viewer URL - used when document is converted to PDF
  const getPdfViewerUrl = () => {
    if (!apiUrl) return url;
    
    // Make sure we use HTTPS URLs
    const secureApiUrl = apiUrl.replace('http://', 'https://');
    return secureApiUrl;
  };
  
  // Default to Office viewer
  const [useDirectViewer, setUseDirectViewer] = useState<boolean>(false);
  
  // Get the current viewer URL based on the state
  const getCurrentViewerUrl = () => {
    return useDirectViewer ? getPdfViewerUrl() : getOfficeViewerUrl();
  };
  
  // Refresh the viewer and optionally toggle between viewers
  const retryLoad = (toggleViewer = false) => {
    setIsLoading(true);
    setError(null);
    
    if (toggleViewer) {
      setUseDirectViewer(!useDirectViewer);
      console.log(`Switching to ${!useDirectViewer ? 'PDF' : 'Microsoft Office'} viewer`);
    }
    
    setRetryCount(prev => prev + 1);
  };

  // Send a message to the parent component when the iframe is loaded
  const handleIframeLoad = () => {
    console.log(`${useDirectViewer ? 'PDF' : 'Microsoft Office'} Word viewer loaded successfully`);
    setIsLoading(false);
    setError(null);
    
    // When Word document is successfully loaded, provide a placeholder text
    // to enable text selection functionality in the parent component
    if (onTextSelect && filename) {
      // Send a small placeholder to initialize text selection
      setTimeout(() => {
        console.log('Initializing text selection for Word document');
        onTextSelect(`[Word Document Ready]: ${filename}`);
      }, 1000);
    }
  };
  
  // Log URLs for debugging
  useEffect(() => {
    // Make sure we use HTTPS URLs
    const secureApiUrl = apiUrl ? apiUrl.replace('http://', 'https://') : '';
    
    console.log('WordViewer mounted with URLs:', { 
      viewerUrl: url, 
      directUrl: secureApiUrl || apiUrl,
      currentViewerUrl: getCurrentViewerUrl(),
      usingViewer: useDirectViewer ? 'PDF' : 'Microsoft Office'
    });
    
    // Set a timeout for loading
    const timeoutId = setTimeout(() => {
      if (isLoading) {
        console.log('Word viewer taking too long to load, showing message');
        setError('The Word document viewer is taking longer than expected. Please try the alternate viewer.');
      }
    }, 15000); // 15 seconds timeout
    
    return () => clearTimeout(timeoutId);
  }, [url, apiUrl, isLoading, useDirectViewer]);

  return (
    <div className="w-full h-full min-h-[600px] flex flex-col relative transform-gpu backface-visibility-hidden">
      {/* Viewer type indicator */}
      <div className="px-8 py-3 bg-blue-50 border-b border-blue-100 text-blue-800 text-sm flex justify-between items-center">
        <span>Using {useDirectViewer ? 'PDF' : 'Microsoft Office Online'} viewer</span>
        <button 
          onClick={() => retryLoad(true)} 
          className="text-blue-600 hover:text-blue-800 px-3 py-1 rounded-md hover:bg-blue-100 transition-colors"
        >
          Try {useDirectViewer ? 'Microsoft Office Online' : 'PDF'} viewer
        </button>
      </div>
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-10">
          <div className="animate-spin rounded-full h-16 w-16 border-t-3 border-b-3 border-blue-500 mb-6"></div>
          <p className="text-gray-600 text-lg mb-2">Loading Word document...</p>
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
              Try {useDirectViewer ? 'Microsoft Office' : 'PDF'} Viewer
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
      
      {/* Word Viewer iframe */}
      <iframe
        key={refreshKey}
        src={getCurrentViewerUrl()}
        className="w-full h-full flex-grow transform-gpu"
        style={{ border: 'none', willChange: 'transform' }}
        onLoad={handleIframeLoad}
        onError={(e) => {
          console.error(`${useDirectViewer ? 'PDF' : 'Microsoft Office'} Word viewer failed to load:`, e);
          setError(`Failed to load Word document with ${useDirectViewer ? 'PDF' : 'Microsoft Office'} viewer. Try the alternate viewer.`);
          setIsLoading(false);
        }}
        sandbox={useDirectViewer ? "allow-scripts allow-same-origin" : "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"}
        referrerPolicy="no-referrer"
        title="Word Document"
      />
    </div>
  );
};

export default WordViewer;