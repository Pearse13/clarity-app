import React, { useState, useEffect } from 'react';
import { PDFViewer } from '../pdf/PDFViewer';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Progress } from '../ui/progress';
import { Button } from '../ui/button';
import { ReloadIcon } from '@radix-ui/react-icons';

interface WordViewerProps {
  url?: string;
  apiUrl?: string;
  filename?: string;
}

interface UploadResponse {
  document_id: string;
  status: string;
  filename: string;
  file_url: string;
  original_url: string;
  type?: string;
  error?: string;
  apiUrl?: string;
  url?: string;
}

export function WordViewer({ url, apiUrl, filename }: WordViewerProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [document, setDocument] = useState<UploadResponse | null>(null);
  const [iframeLoading, setIframeLoading] = useState(false);
  const [apiAccessible, setApiAccessible] = useState(true);

  // Check if backend API is accessible
  useEffect(() => {
    const checkApiAccess = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'https://clarity-backend-production.up.railway.app';
        console.log('Checking backend API access at:', apiUrl);
        
        const response = await fetch(`${apiUrl}/health`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        console.log('Backend API health check status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('Backend API health check response:', data);
          setApiAccessible(true);
        } else {
          console.error('Backend API health check failed:', response.status);
          setApiAccessible(false);
        }
      } catch (error) {
        console.error('Error checking backend API access:', error);
        setApiAccessible(false);
      }
    };
    
    checkApiAccess();
  }, []);

  // Set up document from props if provided
  useEffect(() => {
    if (url && filename) {
      setDocument({
        document_id: 'external',
        status: 'ready',
        filename: filename,
        file_url: url,
        original_url: apiUrl || url,
        type: apiUrl ? 'PDF' : undefined
      });
    }
  }, [url, apiUrl, filename]);

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    const file = files[0];
    console.log('Starting file upload...', {
      filename: file.name,
      size: file.size,
      type: file.type
    });

    // Validate file type
    if (file.type !== 'application/msword' && 
        file.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' &&
        file.type !== 'application/pdf') {
      setError('Please select a Word document (.doc, .docx) or PDF file.');
      return;
    }

    setUploading(true);
    setUploadProgress(10);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Use the document upload endpoint for Word files
      const apiUrl = import.meta.env.VITE_API_URL || 'https://clarity-backend-production.up.railway.app';
      const response = await fetch(`${apiUrl}/api/documents/upload`, {
        method: 'POST',
        body: formData
      });

      setUploadProgress(80);
      console.log('Upload response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${errorText}`);
      }

      const responseData = await response.json();
      console.log('Upload response:', responseData);

      if (!responseData.document_id) {
        throw new Error('No document ID received from server');
      }

      // Handle Word documents - now they may come back as converted PDFs
      if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
          file.type === 'application/msword') {
        
        console.log('Word document uploaded, checking type...');
        
        // Check if it's been converted to PDF
        if (responseData.type === 'PDF') {
          console.log('Word document converted to PDF, using PDF viewer');
          
          // Use the PDF viewer for the converted Word document
          if (!responseData.file_url) {
            throw new Error('No file URL provided in the response for PDF');
          }
          
          try {
            setIframeLoading(true);
            
            const documentData: UploadResponse = {
              document_id: responseData.document_id,
              status: 'ready',
              url: responseData.file_url,
              filename: file.name,
              type: 'PDF',
              apiUrl: responseData.file_url,
              file_url: responseData.file_url,
              original_url: responseData.original_url
            };
            
            setUploadProgress(100);
            setDocument(documentData);
            setIframeLoading(false);
            
            console.log('Word document converted to PDF, viewer setup complete:', documentData);
            return;
          } catch (error) {
            console.error('Error setting up PDF viewer for converted Word document:', error);
            setError('Failed to process converted Word document. Please try again.');
            setUploading(false);
            return;
          }
        } else {
          // Handle as regular Word document (fallback)
          console.error('Word to PDF conversion failed, response:', responseData);
          setError('Failed to convert Word document to PDF. Please try a different file.');
          setUploading(false);
          return;
        }
      }

      // Handle PDF files directly
      if (file.type === 'application/pdf') {
        console.log('PDF file uploaded, processing...');
        
        // Make sure we have a file URL in the response
        if (!responseData.file_url) {
          throw new Error('No file URL provided in the response for PDF');
        }
        
        const pdfUrl = responseData.file_url;
        console.log('PDF URL from response:', pdfUrl);
        
        try {
          setIframeLoading(true);
          
          const documentData: UploadResponse = {
            document_id: responseData.document_id,
            status: 'ready',
            filename: file.name,
            file_url: pdfUrl,
            original_url: pdfUrl,
            type: 'PDF'
          };
          
          setUploadProgress(100);
          setDocument(documentData);
          setIframeLoading(false);
          
          console.log('PDF display data prepared:', documentData);
        } catch (error) {
          console.error('Error setting up PDF viewer:', error);
          setError('Failed to process PDF file. Please try again.');
          setUploading(false);
        }
        return;
      }
      
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (!apiAccessible) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertTitle>Backend API Not Accessible</AlertTitle>
        <AlertDescription>
          Could not connect to the backend API. Please check your connection and try again.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Error message */}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setError(null)} 
              className="ml-2"
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="mb-4">
          <p className="text-sm mb-2">Uploading and processing document...</p>
          <Progress value={uploadProgress} className="h-2" />
        </div>
      )}

      {/* File upload input when no document is loaded */}
      {!document && !uploading && (
        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg mb-4">
          <p className="mb-4">Upload a Word document (.doc, .docx) or PDF file</p>
          <p className="text-sm text-gray-500 mb-4">Word documents will be converted to PDF for viewing</p>
          <input
            type="file"
            accept=".doc,.docx,.pdf"
            onChange={handleFileUpload}
            className="text-sm"
          />
        </div>
      )}

      {/* Viewer for loaded document */}
      {document && (
        <div className="flex-grow h-full">
          {iframeLoading && (
            <div className="flex justify-center items-center h-full">
              <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
              <span>Loading document...</span>
            </div>
          )}
          
          {document.type === 'PDF' ? (
            <PDFViewer 
              url={document.file_url} 
              apiUrl={document.file_url} 
              filename={document.filename} 
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <p>Cannot display this file type. Please convert to PDF for viewing.</p>
              <Button 
                variant="outline" 
                onClick={() => setDocument(null)} 
                className="mt-4"
              >
                Upload Another Document
              </Button>
            </div>
          )}
        </div>
      )}
      
      {/* Upload another button when document is loaded */}
      {document && (
        <div className="mt-4">
          <Button 
            variant="outline" 
            onClick={() => setDocument(null)}
          >
            Upload Another Document
          </Button>
        </div>
      )}
    </div>
  );
} 