import React, { useState, useEffect } from 'react';
import { UploadedFile } from '../../../contexts/FileContext';
import LoadingSpinner from '../../LoadingSpinner';

interface HtmlViewerProps {
  file: UploadedFile;
  onTextExtracted?: (text: string) => void;
}

export const HtmlViewer: React.FC<HtmlViewerProps> = ({ file, onTextExtracted }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string>('');

  useEffect(() => {
    const loadHtmlContent = async () => {
      if (!file.url) {
        setError('No URL available for this file');
        return;
      }

      try {
        setIsLoading(true);
        const response = await fetch(file.url);
        const text = await response.text();
        setHtmlContent(text);
        
        // Extract text content for the parent component
        if (onTextExtracted) {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = text;
          const textContent = tempDiv.textContent || tempDiv.innerText || '';
          onTextExtracted(textContent);
        }
      } catch (err) {
        console.error('Error loading HTML:', err);
        setError(err instanceof Error ? err.message : 'Failed to load HTML content');
      } finally {
        setIsLoading(false);
      }
    };

    loadHtmlContent();
  }, [file.url, onTextExtracted]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        {/* HTML preview in iframe for safety */}
        <iframe
          srcDoc={htmlContent}
          className="w-full h-full border-0"
          sandbox="allow-same-origin"
          title="HTML Preview"
        />
        
        {/* Raw HTML view */}
        <div className="mt-4">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Source Code</h3>
          <pre className="bg-gray-50 p-4 rounded-lg overflow-auto text-sm text-gray-700">
            {htmlContent}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default HtmlViewer; 