import * as pdfjsLib from 'pdfjs-dist';

export const configurePdfWorker = () => {
  try {
    // First try to use the local worker file
    const workerPath = '/pdf.worker.min.js';
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
  } catch (error) {
    console.error('Error configuring local PDF.js worker:', error);
    try {
      // Fallback to CDN with specific version
      pdfjsLib.GlobalWorkerOptions.workerSrc = 
        `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    } catch (cdnError) {
      console.error('Error configuring CDN PDF.js worker:', cdnError);
      // Final fallback to unpkg
      pdfjsLib.GlobalWorkerOptions.workerSrc = 
        `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
    }
  }
};

export default configurePdfWorker; 