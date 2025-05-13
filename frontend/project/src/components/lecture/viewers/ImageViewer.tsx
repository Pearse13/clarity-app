import React, { useState, useEffect } from 'react';
import { UploadedFile } from '../../../contexts/FileContext';
import { ocrService } from '../../../services/ocr';
import LoadingSpinner from '../../LoadingSpinner';

interface ImageViewerProps {
  file: UploadedFile;
  onTextExtracted?: (text: string) => void;
}

interface OcrProgress {
  status: string;
  progress: number;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ file, onTextExtracted }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [ocrText, setOcrText] = useState<string>('');
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);

  useEffect(() => {
    if (file.url && !ocrText && !ocrError) {
      performOcr();
    }
  }, [file.url]);

  const performOcr = async () => {
    if (!file.url) return;

    setIsLoading(true);
    setOcrError(null);
    
    try {
      // Initialize OCR if needed
      if (!ocrService.isInitialized) {
        await ocrService.initialize((progress: OcrProgress) => {
          setOcrProgress(progress);
        });
      }
      
      // Recognize text
      const text = await ocrService.recognizeImage(file.url);
      setOcrText(text);
      
      if (onTextExtracted) {
        onTextExtracted(text);
      }
    } catch (error) {
      console.error('OCR failed:', error);
      setOcrError(error instanceof Error ? error.message : 'OCR processing failed');
    } finally {
      setIsLoading(false);
      setOcrProgress(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        {/* Image preview */}
        <div className="mb-4">
          <img
            src={file.url}
            alt={file.name}
            className="max-w-full h-auto rounded-lg shadow-sm"
          />
        </div>

        {/* OCR Status and Results */}
        <div className="mt-4">
          {isLoading && (
            <div className="flex items-center justify-center p-4">
              <LoadingSpinner />
              <span className="ml-2 text-gray-600">
                {ocrProgress ? `${ocrProgress.status} (${ocrProgress.progress}%)` : 'Processing image...'}
              </span>
            </div>
          )}

          {ocrError && (
            <div className="p-4 bg-red-50 text-red-600 rounded-lg">
              <p className="font-medium">OCR Error</p>
              <p className="text-sm">{ocrError}</p>
              <button
                onClick={performOcr}
                className="mt-2 px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
              >
                Retry OCR
              </button>
            </div>
          )}

          {ocrText && (
            <div className="mt-4">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Extracted Text</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <pre className="whitespace-pre-wrap text-sm text-gray-700">{ocrText}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageViewer; 