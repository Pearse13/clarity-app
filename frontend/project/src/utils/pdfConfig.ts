import * as pdfjsLib from 'pdfjs-dist';

export const configurePdfWorker = () => {
  try {
    // Use the worker file from the public directory
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  } catch (error) {
    console.error('Error configuring PDF.js worker:', error);
    // Fallback to CDN with specific version
    pdfjsLib.GlobalWorkerOptions.workerSrc = 
      `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  }
};

export default configurePdfWorker; 