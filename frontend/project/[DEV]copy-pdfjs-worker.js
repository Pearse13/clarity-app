// [DEV] This file is only used in development environment
// It copies the PDF.js worker file to the public directory
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { copyFileSync, existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define source and destination paths
const sourcePath = join(
  __dirname,
  'node_modules',
  'pdfjs-dist',
  'build',
  'pdf.worker.min.mjs'
);

const destPath = join(__dirname, 'public', 'pdf.worker.min.mjs');

// Create public directory if it doesn't exist
if (!existsSync(join(__dirname, 'public'))) {
  mkdirSync(join(__dirname, 'public'));
}

// Copy the worker file
try {
  copyFileSync(sourcePath, destPath);
  console.log('PDF.js worker file copied successfully!');
} catch (error) {
  console.error('Error copying PDF.js worker file:', error);
  process.exit(1);
} 