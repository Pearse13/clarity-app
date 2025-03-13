import React, { createContext, useContext, useState } from 'react';

export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  progress: number;
  error?: string;
  url?: string;
  textContent?: string;
  file: File;
}

interface FileContextType {
  files: UploadedFile[];
  addFile: (file: UploadedFile) => void;
  removeFile: (id: string) => void;
  updateFileProgress: (id: string, progress: number) => void;
  setFileError: (id: string, error: string) => void;
  setFileTextContent: (id: string, content: string) => void;
  uploadFile: (file: File, extractedText?: string, fileUrl?: string) => Promise<void>;
}

const FileContext = createContext<FileContextType | undefined>(undefined);

export const FileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const addFile = (file: UploadedFile) => {
    setFiles(prev => [...prev, file]);
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.url) {
        URL.revokeObjectURL(file.url);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const updateFileProgress = (id: string, progress: number) => {
    setFiles(prev => prev.map(file => 
      file.id === id ? { ...file, progress } : file
    ));
  };

  const setFileError = (id: string, error: string) => {
    setFiles(prev => prev.map(file => 
      file.id === id ? { ...file, error } : file
    ));
  };

  const setFileTextContent = (id: string, content: string) => {
    setFiles(prev => prev.map(file => 
      file.id === id ? { ...file, textContent: content } : file
    ));
  };

  const uploadFile = async (file: File, extractedText?: string, fileUrl?: string) => {
    const id = Math.random().toString(36).substring(7);
    const newFile: UploadedFile = {
      id,
      name: file.name,
      type: file.type,
      size: file.size,
      progress: 0,
      file,
      textContent: extractedText,
      url: fileUrl || URL.createObjectURL(file)
    };

    addFile(newFile);
    updateFileProgress(id, 100);
  };

  return (
    <FileContext.Provider value={{
      files,
      addFile,
      removeFile,
      updateFileProgress,
      setFileError,
      setFileTextContent,
      uploadFile
    }}>
      {children}
    </FileContext.Provider>
  );
};

export const useFiles = () => {
  const context = useContext(FileContext);
  if (context === undefined) {
    throw new Error('useFiles must be used within a FileProvider');
  }
  return context;
}; 