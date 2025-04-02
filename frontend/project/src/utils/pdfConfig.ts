import * as pdfjsLib from 'pdfjs-dist';

export const configurePdfWorker = () => {
  try {
    // Use dynamic import for the worker
    const workerUrl = new URL(
      'pdfjs-dist/build/pdf.worker.min.js',
      import.meta.url
    ).toString();
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  } catch (error) {
    console.error('Error configuring PDF.js worker:', error);
    // Fallback to CDN with specific version
    pdfjsLib.GlobalWorkerOptions.workerSrc = 
      `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  }
};

export default configurePdfWorker; 