import React, { useState, useEffect } from 'react';
import { RefreshCw, Download } from 'lucide-react';

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

  // Create Office Online Viewer URL with additional parameters for better reliability
  const getOfficeViewerUrl = () => {
    if (!apiUrl) return url;
    
    // Make sure we use HTTPS URLs for Office Online Viewer
    const secureApiUrl = apiUrl.replace('http://', 'https://');
    
    // This should handle the proxy URL correctly, but log it just in case
    console.log('Using Office Online Viewer with URL:', secureApiUrl);
    
    const encodedFileUrl = encodeURIComponent(secureApiUrl);
    const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodedFileUrl}&wdStartOn=1&wdEmbedCode=0&wdAr=1.3333&wdPrint=0&wdModified=${Date.now()}`;
    
    // Log generated URL for debugging
    console.log('Generated Office Viewer URL:', viewerUrl);
    
    return viewerUrl;
  };
  
  // Refresh the viewer
  const retryLoad = () => {
    setIsLoading(true);
    setError(null);
    setRetryCount(prev => prev + 1);
  };
  
  // Log URLs for debugging
  useEffect(() => {
    // Make sure we use HTTPS URLs
    const secureApiUrl = apiUrl ? apiUrl.replace('http://', 'https://') : '';
    
    console.log('PowerPointViewer mounted with URLs:', { 
      viewerUrl: url, 
      directUrl: secureApiUrl || apiUrl,
      officeUrl: getOfficeViewerUrl()
    });
    
    // Set a timeout for loading
    const timeoutId = setTimeout(() => {
      if (isLoading) {
        console.log('PowerPoint viewer taking too long to load, showing message');
        setError('The PowerPoint viewer is taking longer than expected. The file may be too large or temporarily unavailable.');
      }
    }, 15000); // 15 seconds timeout
    
    return () => clearTimeout(timeoutId);
  }, [url, apiUrl, isLoading]);

  return (
    <div className="w-full h-full min-h-[600px] flex flex-col relative">
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
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={retryLoad}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry Loading
            </button>
            
            {apiUrl && (
              <a 
                href={apiUrl.replace('http://', 'https://')}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center justify-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Download PowerPoint
              </a>
            )}
          </div>
        </div>
      )}
      
      {/* PowerPoint Viewer iframe */}
      <iframe
        key={refreshKey}
        src={getOfficeViewerUrl()}
        className="w-full h-full flex-grow"
        style={{ border: 'none' }}
        onLoad={() => {
          console.log('PowerPoint viewer loaded successfully');
          setIsLoading(false);
          setError(null);
        }}
        onError={(e) => {
          console.error('PowerPoint viewer failed to load:', e);
          setError('Failed to load PowerPoint. Please try downloading the file directly.');
          setIsLoading(false);
        }}
        allow="fullscreen"
        title="PowerPoint Presentation"
      />
      
      {/* Download button always visible at the bottom */}
      {apiUrl && (
        <div className="p-2 bg-gray-100 mt-2 rounded flex justify-center">
          <a 
            href={apiUrl.replace('http://', 'https://')}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center"
          >
            <Download className="w-4 h-4 mr-2" />
            Download PowerPoint
          </a>
        </div>
      )}
    </div>
  );
};

export default PowerPointViewer; 