import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

type PowerPointViewerProps = {
  url: string;
  onTextSelect?: (text: string) => void;
};

export const PowerPointViewer: React.FC<PowerPointViewerProps> = ({ 
  url, 
  onTextSelect
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [slideContents, setSlideContents] = useState<{[key: number]: string}>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  
  // Force refresh the iframe when retry is clicked
  const refreshKey = `${url}-${retryCount}-${Date.now()}`;

  // Create direct iframe URL - simplest approach
  const getDirectUrl = () => {
    // Make sure we use HTTPS URLs
    return url.replace('http://', 'https://');
  };
  
  // Create Office Online Viewer URL
  const getOfficeViewerUrl = () => {
    // Make sure we use HTTPS URLs
    const secureUrl = url.replace('http://', 'https://');
    
    // Add cache buster to URL
    const urlWithCacheBuster = `${secureUrl}?t=${Date.now()}`;
    console.log('Using Office Online Viewer with URL:', urlWithCacheBuster);
    
    const encodedFileUrl = encodeURIComponent(urlWithCacheBuster);
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodedFileUrl}&wdStartOn=1&wdEmbedCode=0&wdAr=1.3333&wdPrint=0`;
  };
  
  // We'll use the Office viewer by default (no Google viewer)
  const [useDirectViewer, setUseDirectViewer] = useState<boolean>(false);
  
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
  
  // Log URLs for debugging
  useEffect(() => {
    // Make sure we use HTTPS URLs
    const secureUrl = url ? url.replace('http://', 'https://') : '';
    
    console.log('PowerPointViewer mounted with URLs:', { 
      viewerUrl: url, 
      directUrl: secureUrl || url,
      currentViewerUrl: getCurrentViewerUrl(),
      usingViewer: useDirectViewer ? 'Direct' : 'Microsoft Office'
    });
    
    // Set a timeout for loading
    const timeoutId = setTimeout(() => {
      if (isLoading) {
        console.log('PowerPoint viewer taking too long to load, showing message');
        setError('The PowerPoint viewer is taking longer than expected. Please try the alternate viewer.');
      }
    }, 15000); // 15 seconds timeout
    
    return () => clearTimeout(timeoutId);
  }, [url, isLoading, useDirectViewer]);

  // Function to extract text content from a slide
  const extractSlideContent = (slideElement: Element): string => {
    return slideElement.textContent || '';
  };

  // Function to handle checkbox changes
  const handleSlideSelect = (slideIndex: number, checked: boolean) => {
    // If checked, add the slide's text to the selection
    if (checked && slideContents[slideIndex] && onTextSelect) {
      onTextSelect(slideContents[slideIndex]);
    }
  };

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleIframeLoad = () => {
      setIsLoading(false);
      
      // Access the iframe content
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) return;

      // Find all slides
      const slides = iframeDoc.querySelectorAll('.page-break, div[style*="page-break-before"]');
      
      // Extract text content from each slide
      const contents: {[key: number]: string} = {};
      slides.forEach((slide, index) => {
        contents[index] = extractSlideContent(slide);
      });
      setSlideContents(contents);

      // Add checkboxes next to each slide
      slides.forEach((slide, index) => {
        // Create checkbox container
        const checkboxContainer = iframeDoc.createElement('div');
        checkboxContainer.style.cssText = `
          position: absolute;
          left: -40px;
          top: 50%;
          transform: translateY(-50%);
          z-index: 1000;
          background: white;
          padding: 5px;
          border-radius: 4px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;

        // Create checkbox
        const checkbox = iframeDoc.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.style.cssText = `
          width: 20px;
          height: 20px;
          cursor: pointer;
        `;
        checkbox.addEventListener('change', (e) => {
          const target = e.target as HTMLInputElement;
          handleSlideSelect(index, target.checked);
        });

        checkboxContainer.appendChild(checkbox);
        slide.parentElement?.insertBefore(checkboxContainer, slide);
      });
    };

    iframe.addEventListener('load', handleIframeLoad);
    return () => {
      iframe.removeEventListener('load', handleIframeLoad);
    };
  }, [onTextSelect]);

  return (
    <div className="w-full h-full min-h-[600px] flex flex-col relative transform-gpu backface-visibility-hidden">
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
        key={refreshKey}
        ref={iframeRef}
        src={getCurrentViewerUrl()}
        className="w-full h-full flex-grow transform-gpu"
        style={{ border: 'none', willChange: 'transform' }}
        onLoad={() => {
          console.log(`${useDirectViewer ? 'Direct' : 'Microsoft Office'} PowerPoint viewer loaded successfully`);
          setIsLoading(false);
          setError(null);
        }}
        onError={(e) => {
          console.error(`${useDirectViewer ? 'Direct' : 'Microsoft Office'} PowerPoint viewer failed to load:`, e);
          setError(`Failed to load PowerPoint with ${useDirectViewer ? 'Direct' : 'Microsoft Office'} viewer. Try the alternate viewer.`);
          setIsLoading(false);
        }}
        sandbox={useDirectViewer ? "allow-same-origin" : "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"}
        referrerPolicy="no-referrer"
        title="PowerPoint Presentation"
      />
    </div>
  );
};

export default PowerPointViewer; 