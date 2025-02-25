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
}

interface FileContextType {
  files: UploadedFile[];
  addFile: (file: UploadedFile) => void;
  removeFile: (id: string) => void;
  updateFileProgress: (id: string, progress: number) => void;
  setFileError: (id: string, error: string) => void;
  setFileTextContent: (id: string, content: string) => void;
  uploadFile: (file: File) => Promise<void>;
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

  const uploadFile = async (file: File) => {
    const fileId = Math.random().toString(36).substring(7);
    const fileUrl = URL.createObjectURL(file);
    
    // Add file to state immediately with URL
    addFile({
      id: fileId,
      name: file.name,
      type: file.type,
      size: file.size,
      progress: 0,
      url: fileUrl
    });

    try {
      // For text files, read the content
      if (file.type === 'text/plain') {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          setFileTextContent(fileId, content);
        };
        reader.readAsText(file);
      }

      // Simulate upload progress
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        updateFileProgress(fileId, progress);
        if (progress >= 100) {
          clearInterval(interval);
        }
      }, 500);

      // TODO: Replace with actual file upload
      // const formData = new FormData();
      // formData.append('file', file);
      // const response = await fetch('/api/upload', {
      //   method: 'POST',
      //   body: formData
      // });
      // if (!response.ok) throw new Error('Upload failed');
      // const data = await response.json();
      // updateFileProgress(fileId, 100);

    } catch (error) {
      setFileError(fileId, error instanceof Error ? error.message : 'Upload failed');
      URL.revokeObjectURL(fileUrl);
    }
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