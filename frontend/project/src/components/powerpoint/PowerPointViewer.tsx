import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

export type PowerPointViewerProps = {
  url: string;
  apiUrl?: string;
  filename: string;
};

export const PowerPointViewer: React.FC<PowerPointViewerProps> = ({ url, apiUrl, filename }) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  
  // Force refresh the iframe when retry is clicked
  const refreshKey = `${url}-${retryCount}`;

  // Create Google Drive Viewer URL - this is generally more reliable
  const getGoogleViewerUrl = () => {
    if (!apiUrl) return url;
    
    // Make sure we use HTTPS URLs
    const secureApiUrl = apiUrl.replace('http://', 'https://');
    
    // Create a URL with a cache buster
    const urlWithCacheBuster = `${secureApiUrl}?t=${Date.now()}`;
    console.log('Using Google Drive Viewer with URL:', urlWithCacheBuster);
    
    // Google Docs Viewer
    return `https://docs.google.com/viewer?url=${encodeURIComponent(urlWithCacheBuster)}&embedded=true`;
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
    const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodedFileUrl}&wdStartOn=1&wdEmbedCode=0&wdAr=1.3333&wdPrint=0`;
    
    return viewerUrl;
  };
  
  // We'll try to use Google Drive viewer by default
  const [useGoogleViewer, setUseGoogleViewer] = useState<boolean>(true);
  
  // Get the current viewer URL based on the state
  const getCurrentViewerUrl = () => {
    return useGoogleViewer ? getGoogleViewerUrl() : getOfficeViewerUrl();
  };
  
  // Refresh the viewer and optionally toggle between viewers
  const retryLoad = (toggleViewer = false) => {
    setIsLoading(true);
    setError(null);
    
    if (toggleViewer) {
      setUseGoogleViewer(!useGoogleViewer);
      console.log(`Switching to ${!useGoogleViewer ? 'Google Drive' : 'Office Online'} viewer`);
    }
    
    setRetryCount(prev => prev + 1);
  };
  
  // Log URLs for debugging
  useEffect(() => {
    // Make sure we use HTTPS URLs
    const secureApiUrl = apiUrl ? apiUrl.replace('http://', 'https://') : '';
    
    console.log('PowerPointViewer mounted with URLs:', { 
      viewerUrl: url, 
      directUrl: secureApiUrl || apiUrl,
      currentViewerUrl: getCurrentViewerUrl(),
      usingViewer: useGoogleViewer ? 'Google Drive' : 'Office Online'
    });
    
    // Set a timeout for loading
    const timeoutId = setTimeout(() => {
      if (isLoading) {
        console.log('PowerPoint viewer taking too long to load, showing message');
        setError('The PowerPoint viewer is taking longer than expected. Please try the alternate viewer.');
      }
    }, 15000); // 15 seconds timeout
    
    return () => clearTimeout(timeoutId);
  }, [url, apiUrl, isLoading, useGoogleViewer]);

  return (
    <div className="w-full h-full min-h-[600px] flex flex-col relative">
      {/* Viewer type indicator */}
      <div className="p-2 bg-blue-50 border-b border-blue-100 text-blue-800 text-xs flex justify-between items-center">
        <span>Using {useGoogleViewer ? 'Google Drive' : 'Microsoft Office Online'} viewer</span>
        <button 
          onClick={() => retryLoad(true)} 
          className="text-blue-600 hover:text-blue-800 text-xs"
        >
          Try {useGoogleViewer ? 'Microsoft Office Online' : 'Google Drive'} viewer
        </button>
      </div>
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">Loading PowerPoint presentation...</p>
          <p className="mt-2 text-sm text-gray-500">This may take a few moments for large files</p>
          {retryCount > 0 && (
            <p className="mt-2 text-xs text-gray-400">Retry attempt: {retryCount}</p>
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
              Try {useGoogleViewer ? 'Microsoft' : 'Google'} Viewer
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
        key={refreshKey}
        src={getCurrentViewerUrl()}
        className="w-full h-full flex-grow"
        style={{ border: 'none' }}
        onLoad={() => {
          console.log(`${useGoogleViewer ? 'Google Drive' : 'Office Online'} PowerPoint viewer loaded successfully`);
          setIsLoading(false);
          setError(null);
        }}
        onError={(e) => {
          console.error(`${useGoogleViewer ? 'Google Drive' : 'Office Online'} PowerPoint viewer failed to load:`, e);
          setError(`Failed to load PowerPoint with ${useGoogleViewer ? 'Google Drive' : 'Office Online'} viewer. Try the alternate viewer.`);
          setIsLoading(false);
        }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
        referrerPolicy="no-referrer"
        title="PowerPoint Presentation"
      />
    </div>
  );
};

export default PowerPointViewer; 