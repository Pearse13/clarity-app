import React, { useState } from 'react';
import { UploadedFile } from '../../../contexts/FileContext';

interface WordViewerProps {
  file: UploadedFile;
}

export const WordViewer: React.FC<WordViewerProps> = ({ file }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingGoogleViewer, setUsingGoogleViewer] = useState(false);
  
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

export default WordViewer; 