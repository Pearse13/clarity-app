import React from 'react';
import { X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useFiles, UploadedFile } from '../../contexts/FileContext';

const FileList: React.FC = () => {
  const { files, removeFile } = useFiles();

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getFileIcon = (file: UploadedFile) => {
    if (file.error) {
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
    if (file.progress === 100) {
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    }
    return null;
  };

  if (files.length === 0) return null;

  return (
    <div className="mt-6 space-y-4">
      {files.map((file) => (
        <div
          key={file.id}
          className="bg-white rounded-lg p-4 flex items-center gap-4 shadow-sm"
        >
          {getFileIcon(file)}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start">
              <p className="text-sm font-medium text-gray-900 truncate">
                {file.name}
              </p>
              <button
                onClick={() => removeFile(file.id)}
                className="ml-2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              {formatFileSize(file.size)}
            </p>
            {file.error ? (
              <p className="text-xs text-red-500 mt-1">{file.error}</p>
            ) : file.progress !== undefined && file.progress < 100 ? (
              <div className="mt-2">
                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${file.progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {file.progress}% uploaded
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
};

export default FileList; 