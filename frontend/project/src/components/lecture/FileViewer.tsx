import React, { useEffect, useState } from 'react';
import { File, X, ArrowRight } from 'lucide-react';
import { useFiles } from '../../contexts/FileContext';

interface FileViewerProps {
  onAddToTransform?: (text: string) => void;
}

const FileViewer: React.FC<FileViewerProps> = ({ onAddToTransform }) => {
  const { files, removeFile } = useFiles();
  const currentFile = files[files.length - 1]; // Show most recently uploaded file
  const [selectedText, setSelectedText] = useState<string>('');

  useEffect(() => {
    // Clean up object URLs when component unmounts or file changes
    return () => {
      if (currentFile?.url) {
        URL.revokeObjectURL(currentFile.url);
      }
    };
  }, [currentFile]);

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      setSelectedText(selection.toString().trim());
    } else {
      setSelectedText('');
    }
  };

  if (!currentFile || currentFile.error) return null;

  const renderFilePreview = () => {
    if (currentFile.progress !== 100) {
      return (
        <div className="text-center w-full">
          <div className="w-full max-w-xs mx-auto mb-4">
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${currentFile.progress}%` }}
              />
            </div>
          </div>
          <p className="text-sm text-gray-600">
            Uploading... {currentFile.progress}%
          </p>
        </div>
      );
    }

    // For PDFs, display in an iframe
    if (currentFile.type === 'application/pdf') {
      return (
        <iframe
          src={currentFile.url}
          className="w-full h-full border-0"
          title={currentFile.name}
        />
      );
    }

    // For text files, display in a pre tag with conditional "Add to Understand" button
    if (currentFile.type === 'text/plain') {
      return (
        <div className="flex flex-col h-full w-full">
          <div className="flex-1 relative">
            <pre 
              onMouseUp={handleTextSelection}
              onKeyUp={handleTextSelection}
              className="absolute inset-0 p-4 bg-white rounded border text-sm font-mono whitespace-pre-wrap overflow-auto"
            >
              {currentFile.textContent || 'Loading text content...'}
            </pre>
          </div>
          {selectedText && onAddToTransform && (
            <div className="flex items-center gap-2 mt-4 animate-fade-in">
              <button
                onClick={() => {
                  onAddToTransform(selectedText);
                  setSelectedText('');
                }}
                className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Add Selection to Understand
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      );
    }

    // For Word documents, show a message since they can't be previewed directly
    if (currentFile.type === 'application/msword' || 
        currentFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return (
        <div className="text-center p-8 w-full">
          <File className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">Word document preview is not available</p>
          <a 
            href={currentFile.url} 
            download={currentFile.name}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Download to view
          </a>
        </div>
      );
    }

    return (
      <div className="text-center w-full">
        <p className="text-sm text-gray-600">Preview not available for this file type</p>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-8 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <File className="w-5 h-5 text-blue-600" />
          <span className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
            {currentFile.name}
          </span>
        </div>
        <button
          onClick={() => removeFile(currentFile.id)}
          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Remove file"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* File Preview Area */}
      <div className="bg-gray-50 rounded-lg p-4 h-[calc(100%-4rem)] flex">
        {renderFilePreview()}
      </div>
    </div>
  );
};

export default FileViewer; 