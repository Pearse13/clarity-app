import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { copyFileSync, existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get the PDF.js version from node_modules
const pdfJsPath = join(__dirname, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.js');
const destPath = join(__dirname, 'public', 'pdf.worker.min.js');

// Create public directory if it doesn't exist
if (!existsSync(join(__dirname, 'public'))) {
  mkdirSync(join(__dirname, 'public'));
}

// Copy the worker file
copyFileSync(pdfJsPath, destPath);
console.log('PDF.js worker file copied successfully!'); 