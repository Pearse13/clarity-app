import React, { useState } from 'react';
import { UploadedFile } from '../../../contexts/FileContext';
import LoadingSpinner from '../../LoadingSpinner';

interface PowerPointViewerProps {
  file: UploadedFile;
}

export const PowerPointViewer: React.FC<PowerPointViewerProps> = ({ file }) => {
  const [isLoading, setIsLoading] = useState(true);
  
  // Get and validate the public URL for the file
  const fileUrl = file.url || '';
  
  // Show upload progress if file is still uploading
  if (file.progress !== undefined && file.progress < 100) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50">
        <div className="w-64 bg-white p-6 rounded-lg shadow-lg">
          <div className="mb-4">
            <div className="h-2 bg-gray-200 rounded">
              <div 
                className="h-full bg-blue-600 rounded transition-all duration-300" 
                style={{ width: `${file.progress}%` }}
              />
            </div>
          </div>
          <p className="text-center text-sm text-gray-600">
            Uploading presentation... {Math.round(file.progress)}%
          </p>
        </div>
      </div>
    );
  }

  if (!file.url) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500">Error: No URL available for this file</div>
      </div>
    );
  }
  
  return (
    <div className="relative h-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
          <LoadingSpinner />
        </div>
      )}
      <iframe
        src={`https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`}
        className="w-full h-full border-0"
        onLoad={() => setIsLoading(false)}
        style={{ pointerEvents: 'auto' }}
      />
    </div>
  );
};

export default PowerPointViewer;