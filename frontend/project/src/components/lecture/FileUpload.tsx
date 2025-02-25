import React, { useCallback } from 'react';
import { Upload } from 'lucide-react';
import { useFiles } from '../../contexts/FileContext';
import FileViewer from './FileViewer';

interface FileUploadProps {
  onTextLoaded: (text: string) => void;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const SUPPORTED_FORMATS = [
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const FileUpload: React.FC<FileUploadProps> = ({ onTextLoaded }) => {
  const { files, uploadFile } = useFiles();
  const hasFile = files.length > 0;

  const validateFile = (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      return 'File size exceeds 20MB limit';
    }
    if (!SUPPORTED_FORMATS.includes(file.type)) {
      return 'Unsupported file format. Please upload a PDF, TXT, DOC, or DOCX file';
    }
    return null;
  };

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    const file = fileList[0];
    const error = validateFile(file);
    if (error) {
      alert(error);
      return;
    }

    await uploadFile(file);
    event.target.value = ''; // Reset input
  }, [uploadFile]);

  if (hasFile) {
    return <FileViewer onAddToTransform={onTextLoaded} />;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-8">
      <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <Upload className="w-12 h-12 text-gray-400 mb-3" />
          <p className="mb-2 text-sm text-gray-500">
            <span className="font-semibold">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-500">PDF, TXT, DOC, DOCX (up to 20MB)</p>
        </div>
        <input
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept=".pdf,.txt,.doc,.docx,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        />
      </label>
    </div>
  );
};

export default FileUpload; 