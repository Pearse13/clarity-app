import React, { useCallback, useEffect } from 'react';
import { Upload, X } from 'lucide-react';
import { useFiles } from '../../contexts/FileContext';
import FileViewer from './FileViewer';
import * as pdfjsLib from 'pdfjs-dist';

interface FileUploadProps {
  onTextLoaded: (text: string) => void;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const SUPPORTED_FORMATS = [
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/html'
];

const FileUpload: React.FC<FileUploadProps> = ({ onTextLoaded }) => {
  const { files, uploadFile } = useFiles();
  const hasFile = files.length > 0;

  // Initialize PDF.js worker
  useEffect(() => {
    // Set up PDF.js worker using CDN for reliability
    pdfjsLib.GlobalWorkerOptions.workerSrc = 
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  }, []);

  const validateFile = (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      return 'File size exceeds 20MB limit';
    }
    if (!SUPPORTED_FORMATS.includes(file.type)) {
      return 'Unsupported file format. Please upload a PDF, TXT, DOC, DOCX, PPT, PPTX, HTML, or image file (JPEG, PNG, GIF, WEBP)';
    }
    return null;
  };

  const extractPdfText = async (file: File): Promise<{ fullText: string; preview: string }> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      let fullText = '';
      const numPages = pdf.numPages;

      // Extract text from all pages
      for (let i = 1; i <= numPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          fullText += pageText + '\n\n';
        } catch (pageError) {
          console.error(`Error extracting text from page ${i}:`, pageError);
          continue;
        }
      }

      if (!fullText.trim()) {
        throw new Error('No text could be extracted from the PDF');
      }

      // Clean and prepare text
      const cleanText = fullText.trim().replace(/\s+/g, ' ');
      const words = cleanText.split(' ');
      const totalWords = words.length;
      
      // Calculate optimal section sizes based on document length
      const startLength = Math.min(1500, Math.floor(totalWords * 0.4)); // 40% of start or 1500 words
      const middleLength = Math.min(750, Math.floor(totalWords * 0.2)); // 20% of middle or 750 words
      const endLength = Math.min(750, Math.floor(totalWords * 0.2)); // 20% of end or 750 words

      // Get document sections
      const startPreview = words.slice(0, startLength).join(' ');
      
      const midIndex = Math.floor(words.length / 2);
      const midStart = Math.max(0, midIndex - Math.floor(middleLength / 2));
      const midEnd = Math.min(words.length, midIndex + Math.floor(middleLength / 2));
      const middlePreview = words.slice(midStart, midEnd).join(' ');
      
      const endPreview = words.slice(-endLength).join(' ');

      // Create structured preview with metadata
      const preview = `[Document Analysis for GPT-4]
Document Statistics:
- Total Pages: ${numPages}
- Total Words: ${totalWords}
- Sampling Coverage: ~${Math.round((startLength + middleLength + endLength) / totalWords * 100)}% of document

[Introduction - First ${startLength} words]
${startPreview}

[Core Content - ${middleLength} words from middle]
${middlePreview}

[Conclusion - Last ${endLength} words]
${endPreview}

Note: This is a smart sample of the document optimized for GPT-4 analysis. The sample includes key sections from the beginning, middle, and end to provide comprehensive context while maintaining reasonable token usage.`;

      return { 
        fullText: cleanText,
        preview: preview
      };
    } catch (error) {
      console.error('Error extracting PDF text:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to extract text from PDF');
    }
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

    try {
      let text: string | undefined;
      let preview: string | undefined;
      let url: string | undefined;
      
      // Handle PDF files
      if (file.type === 'application/pdf') {
        const result = await extractPdfText(file);
        text = result.fullText;
        preview = result.preview;
        if (!text) {
          throw new Error('No text could be extracted from the PDF');
        }
      }
      
      // Handle PowerPoint files
      if (file.type === 'application/vnd.ms-powerpoint' || 
          file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
        // Create a URL for the PowerPoint file
        url = URL.createObjectURL(file);
        // Create a simple preview message
        preview = `PowerPoint file loaded: ${file.name}\nSize: ${(file.size / 1024 / 1024).toFixed(2)} MB`;
      }

      // Upload file and handle text content
      await uploadFile(file, text, url);
      
      // If we have extracted text, pass the preview to the parent
      if (preview) {
        onTextLoaded(preview);
      } else if (text) {
        onTextLoaded(text);
      }

      event.target.value = ''; // Reset input
    } catch (error) {
      console.error('Error processing file:', error);
      alert(error instanceof Error ? error.message : 'Error processing file. Please try again.');
    }
  }, [uploadFile, onTextLoaded]);

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  // Handle text selected for transformation
  const handleAddToTransform = (selectedText: string) => {
    if (selectedText && selectedText.trim().length > 0) {
      console.log("Selected text for transformation:", selectedText.slice(0, 50) + "...");
      onTextLoaded(selectedText);
    }
  };

  return (
    <div className="flex flex-col bg-white rounded-lg border-2 border-gray-300 overflow-hidden" 
         style={{ height: '800px', maxHeight: '800px' }}>
      <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-700">Upload File</h2>
        {hasFile && (
          <button
            onClick={() => {
              // Clear file logic here
            }}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Clear file"
          >
            <X size={20} />
          </button>
        )}
      </div>
      
      <div className="flex-1 overflow-hidden">
        {hasFile ? (
          <div className="h-full overflow-hidden">
            <FileViewer onAddToTransform={handleAddToTransform} />
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-6">
            <div
              className="w-full h-full border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <Upload size={48} className="text-gray-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">Drag &amp; Drop File</h3>
              <p className="text-sm text-gray-500 mb-1">
                Supported formats:
              </p>
              <p className="text-sm text-gray-500 mb-4">
                PDF, DOC/DOCX (Word), PPT/PPTX (PowerPoint),<br />
                TXT (Plain Text), HTML, JPG/PNG/GIF/WEBP (Images)
              </p>
              <p className="text-xs text-gray-400 mb-4">
                Maximum file size: 20MB
              </p>
              <p className="text-xs text-gray-500">
                Click anywhere in this area to browse
              </p>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.txt,.doc,.docx,.ppt,.pptx,.html,.jpg,.jpeg,.png,.gif,.webp"
                onChange={handleFileChange}
                id="file-input"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUpload; 