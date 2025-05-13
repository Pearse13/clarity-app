import React from 'react';
import { useFiles } from '../../contexts/FileContext';
import WordViewer from './viewers/WordViewer';
import PowerPointViewer from './viewers/PowerPointViewer';
import ImageViewer from './viewers/ImageViewer';
import HtmlViewer from './viewers/HtmlViewer';

// Add CSS classes to enforce consistent layout with strict height limits
const CONTAINER_CLASSES = "h-full flex flex-col";
const HEADER_CLASSES = "text-center p-2 border-b bg-blue-50 flex-shrink-0";
const CONTENT_CLASSES = "flex-1 overflow-y-auto custom-scrollbar";

interface FileViewerProps {
  onAddToTransform?: (text: string) => void;
}

const FileViewer: React.FC<FileViewerProps> = ({ onAddToTransform }) => {
  const { files } = useFiles();
  const currentFile = files[files.length - 1];

  // Handle text extraction from any viewer
  const handleTextExtracted = (text: string) => {
    if (onAddToTransform) {
      onAddToTransform(text);
    }
  };

  if (!currentFile) {
    return null;
  }

  const renderViewer = () => {
    switch (currentFile.type) {
      case 'application/msword':
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return <WordViewer file={currentFile} />;

      case 'application/vnd.ms-powerpoint':
      case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        return <PowerPointViewer file={currentFile} />;

      case 'image/jpeg':
      case 'image/png':
      case 'image/gif':
      case 'image/webp':
        return <ImageViewer file={currentFile} onTextExtracted={handleTextExtracted} />;

      case 'text/html':
        return <HtmlViewer file={currentFile} onTextExtracted={handleTextExtracted} />;

      default:
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">
              Unsupported file type: {currentFile.type}
            </div>
          </div>
        );
    }
  };

  return (
    <div className={CONTAINER_CLASSES}>
      <div className={HEADER_CLASSES}>
        <h2 className="text-lg font-medium text-gray-800">
          {currentFile.name}
        </h2>
      </div>
      <div className={CONTENT_CLASSES}>
        {renderViewer()}
      </div>
    </div>
  );
};

export default FileViewer; 