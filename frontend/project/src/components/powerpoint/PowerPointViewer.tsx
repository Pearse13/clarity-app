import React from 'react';
import { Upload } from 'lucide-react';
import { PDFViewer } from '../pdf/PDFViewer';

export interface PowerPointViewerProps {
  url: string;
  onTextSelect?: (text: string) => void;
  onDocumentTextExtracted?: (text: string | null) => void;
  onUploadAnother?: () => void;
  isUploading?: boolean;
  uploadProgress?: number;
}

export const PowerPointViewer: React.FC<PowerPointViewerProps> = ({ 
  url,
  onTextSelect,
  onDocumentTextExtracted,
  onUploadAnother,
  isUploading = false,
  uploadProgress = 0
}) => {
  // Extract filename from URL
  const getFilename = () => {
    try {
      const urlParts = url.split('/');
      return urlParts[urlParts.length - 1] || 'presentation.pdf';
    } catch (e) {
      return 'presentation.pdf';
    }
  };

  // Handle text selection with extracted text
  const handleTextSelect = (text: string, extractedText?: string) => {
    if (onTextSelect) {
      onTextSelect(text);
    }
    // If we get extracted text from PDFViewer and have the callback, pass it through
    if (extractedText && onDocumentTextExtracted) {
      onDocumentTextExtracted(extractedText);
    }
  };

  return (
    <div className="w-full h-full min-h-[600px] flex flex-col relative">
      {/* Header */}
      <div className="px-4 py-3 bg-white border-b flex justify-end">
        {onUploadAnother && (
          <button
            onClick={onUploadAnother}
            className="flex items-center gap-2 px-3 py-1 text-sm text-blue-600 hover:bg-gray-100 rounded transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload Another
          </button>
        )}
      </div>

      {/* Upload progress */}
      {isUploading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50/90 z-30">
          <div className="w-64 bg-white p-6 rounded-lg shadow-lg">
            <div className="mb-4">
              <div className="h-2 bg-gray-200 rounded">
                <div 
                  className="h-full bg-blue-600 rounded transition-all duration-300" 
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
            <p className="text-center text-sm text-gray-600">
              Uploading presentation... {Math.round(uploadProgress)}%
            </p>
          </div>
        </div>
      )}
      
      {/* PDF Viewer */}
      <PDFViewer
        url={url}
        filename={getFilename()}
        onTextSelect={handleTextSelect}
        onDocumentTextExtracted={onDocumentTextExtracted}
        defaultZoom={1}
      />
    </div>
  );
};

export default PowerPointViewer; 