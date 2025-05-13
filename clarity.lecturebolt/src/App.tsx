import React, { useState, useEffect, useCallback } from 'react';
import { Upload, Brain, MessageSquare, Wand2, AlertCircle, RefreshCw } from 'lucide-react';

interface UploadResponse {
  id: string;
  url: string;
  filename: string;
}

// API base URL - use environment variable or fallback to Railway URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://clarity-backend-production.up.railway.app';

function App() {
  const [selectedOption, setSelectedOption] = useState<'understand' | 'chat' | 'create'>('understand');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presentation, setPresentation] = useState<UploadResponse | null>(null);
  const [iframeLoading, setIframeLoading] = useState(false);
  const [iframeError, setIframeError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type - update to support all document types
    if (!file.name.toLowerCase().match(/\.(ppt|pptx|doc|docx|pdf)$/)) {
      setError('Please select a supported file (.ppt, .pptx, .doc, .docx, .pdf)');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setIframeError(null);
      setRetryCount(0);

      const formData = new FormData();
      formData.append('file', file);

      console.log('Starting file upload...', {
        filename: file.name,
        size: file.size,
        type: file.type,
        apiUrl: `${API_BASE_URL}/api/presentations/upload`
      });

      // Use the full API URL instead of a relative path
      const response = await fetch(`${API_BASE_URL}/api/presentations/upload`, {
        method: 'POST',
        body: formData,
        // Remove credentials mode to fix CORS error
        // credentials: 'include',
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      const responseText = await response.text();
      console.log('Raw response:', responseText);

      if (!response.ok) {
        let errorDetail;
        try {
          errorDetail = JSON.parse(responseText).detail;
        } catch {
          errorDetail = responseText || 'Failed to upload presentation';
        }
        throw new Error(errorDetail);
      }

      const data = JSON.parse(responseText);
      console.log('Parsed response data:', data);

      // Update presentation state with the correct URL
      if (data.document_id) {
        // Check if there's a specific file URL in the response
        let fileUrl = '';
        
        // For PDF files, use the direct PDF URL
        if (file.name.toLowerCase().endsWith('.pdf')) {
          // Try different URL patterns for PDF files
          // First, try the documents directory (preferred)
          fileUrl = `${API_BASE_URL}/documents/${data.document_id}/presentation.pdf`;
          
          // Check if there's a files object with a PDF path
          if (data.files && data.files.pdf) {
            // Make sure we have the full URL
            if (data.files.pdf.startsWith('/')) {
              fileUrl = `${API_BASE_URL}${data.files.pdf}`;
            } else {
              fileUrl = data.files.pdf;
            }
          }
          
          console.log('Using PDF URL:', fileUrl);
        } else {
          // For other file types, use the index.html
          fileUrl = `${API_BASE_URL}/api/presentations/files/${data.document_id}/index.html`;
        }
        
        console.log('Using file URL:', fileUrl);
        
        setPresentation({
          id: data.document_id,
          url: fileUrl,
          filename: file.name
        });
        setIframeLoading(true);
      } else {
        throw new Error('Invalid response format from server');
      }
      
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload presentation');
    } finally {
      setUploading(false);
    }
  };

  const handleIframeLoad = (event: React.SyntheticEvent<HTMLElement>) => {
    console.log('iframe loaded');
    setIframeLoading(false);
    setIframeError(null);
    setRetryCount(0);
  };

  const handleIframeError = (event: React.SyntheticEvent<HTMLElement>) => {
    console.error('iframe error:', event);
    setIframeError('Failed to load presentation preview');
    setIframeLoading(false);
  };

  const retryLoad = useCallback(() => {
    if (!presentation || retryCount >= 3) return;
    
    console.log('Retrying iframe load...');
    setIframeLoading(true);
    setIframeError(null);
    setRetryCount(prev => prev + 1);
    
    // Force iframe reload by updating the URL with a timestamp
    const timestamp = new Date().getTime();
    const url = new URL(presentation.url, window.location.origin);
    url.searchParams.set('t', timestamp.toString());
    
    // Update the iframe src
    const iframe = document.querySelector('iframe');
    if (iframe) {
      iframe.src = url.toString();
    }
  }, [presentation, retryCount]);

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex">
      {/* Left Side - File Upload */}
      <div className="w-1/2 flex items-center justify-center border-r border-gray-200/50">
        {presentation ? (
          // Presentation Viewer
          <div className="w-full h-full p-4">
            <div className="mb-4 flex justify-between items-center">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setPresentation(null);
                    setIframeError(null);
                    setRetryCount(0);
                  }}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Upload Another
                </button>
                {iframeError && (
                  <button
                    onClick={retryLoad}
                    disabled={retryCount >= 3}
                    className={`px-4 py-2 text-sm rounded-lg flex items-center gap-2 ${
                      retryCount >= 3
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Retry
                  </button>
                )}
              </div>
              {iframeError && (
                <p className="text-sm text-red-500">
                  {iframeError}
                  {retryCount >= 3 ? ' (Max retries reached)' : ''}
                </p>
              )}
            </div>
            {iframeLoading && (
              <div className="w-full h-[calc(100%-60px)] flex items-center justify-center bg-white rounded-xl">
                <div className="flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
                  <p className="text-gray-500">Loading presentation...</p>
                </div>
              </div>
            )}
            {/* Use object tag for PDFs and iframe for other file types */}
            {presentation.filename.toLowerCase().endsWith('.pdf') ? (
              <object
                data={presentation.url}
                type="application/pdf"
                className={`w-full h-[calc(100%-60px)] border-0 rounded-xl shadow-sm bg-white ${
                  iframeLoading ? 'hidden' : ''
                }`}
                onLoad={handleIframeLoad}
                onError={handleIframeError}
              >
                <div className="w-full h-full flex items-center justify-center">
                  <p className="text-gray-500">
                    Unable to display PDF. <a href={presentation.url} target="_blank" rel="noopener noreferrer" className="text-blue-600">Download</a> instead.
                  </p>
                </div>
              </object>
            ) : (
              <iframe
                src={presentation.url}
                className={`w-full h-[calc(100%-60px)] border-0 rounded-xl shadow-sm bg-white ${
                  iframeLoading ? 'hidden' : ''
                }`}
                title={presentation.filename}
                sandbox="allow-same-origin allow-scripts"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
              />
            )}
          </div>
        ) : (
          // Upload Area
          <label 
            htmlFor="file-upload"
            className={`
              flex flex-col items-center gap-4 p-6 rounded-2xl 
              ${uploading ? 'bg-blue-50' : 'bg-white/80'} 
              backdrop-blur-xl shadow-sm hover:bg-white/90 
              transition-colors cursor-pointer
            `}
          >
            {error ? (
              <AlertCircle className="w-8 h-8 text-red-500 stroke-[1.5]" />
            ) : uploading ? (
              <RefreshCw className="w-8 h-8 text-blue-600 stroke-[1.5] animate-spin" />
            ) : (
              <Upload className="w-8 h-8 text-blue-600 stroke-[1.5]" />
            )}
            <span className="text-[15px] text-gray-900 font-medium tracking-tight">
              {uploading ? 'Uploading...' : 'Upload Document'}
            </span>
            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}
            <p className="text-xs text-gray-500">
              Supported files: PowerPoint (.ppt, .pptx), PDF (.pdf)
            </p>
            <input 
              id="file-upload" 
              type="file"
              accept=".ppt,.pptx,.pdf"
              className="hidden" 
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
        )}
      </div>

      {/* Right Side - Options */}
      <div className="w-1/2 p-8">
        <div className="max-w-md mx-auto">
          {/* Options Selector */}
          <div className="flex gap-4 mb-8">
            <button
              onClick={() => setSelectedOption('understand')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-colors ${
                selectedOption === 'understand'
                ? 'bg-blue-600 text-white'
                : 'bg-white/80 backdrop-blur-xl text-gray-600 hover:bg-white/90'
              }`}
            >
              <Brain className="w-4 h-4 stroke-[1.5]" />
              Understand
            </button>
            <button
              onClick={() => setSelectedOption('chat')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-colors ${
                selectedOption === 'chat'
                ? 'bg-blue-600 text-white'
                : 'bg-white/80 backdrop-blur-xl text-gray-600 hover:bg-white/90'
              }`}
            >
              <MessageSquare className="w-4 h-4 stroke-[1.5]" />
              Chat
            </button>
            <button
              onClick={() => setSelectedOption('create')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-colors ${
                selectedOption === 'create'
                ? 'bg-blue-600 text-white'
                : 'bg-white/80 backdrop-blur-xl text-gray-600 hover:bg-white/90'
              }`}
            >
              <Wand2 className="w-4 h-4 stroke-[1.5]" />
              Create
            </button>
          </div>

          {/* Content Area */}
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-sm">
            {selectedOption === 'understand' && (
              <div className="text-[15px] text-gray-600">
                {presentation ? (
                  <>
                    <p className="mb-2">PowerPoint file loaded: {presentation.filename}</p>
                    <p>Choose an option above to begin analysis.</p>
                  </>
                ) : (
                  <p>Upload your PowerPoint presentation to get started.</p>
                )}
              </div>
            )}
            {selectedOption === 'chat' && (
              <p className="text-[15px] text-gray-600">
                Have an interactive discussion about your presentation.
              </p>
            )}
            {selectedOption === 'create' && (
              <p className="text-[15px] text-gray-600">
                Generate new content based on your presentation.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;