import { createWorker, createScheduler } from 'tesseract.js';

interface OcrProgress {
  status: string;
  progress: number;
}

const STATUS_MAP: { [key: string]: string } = {
  'loading tesseract core': 'Initializing OCR...',
  'initializing api': 'Setting up...',
  'loading language traineddata': 'Loading language data...',
  'initializing lstm': 'Preparing recognition...',
  'recognizing text': 'Reading text...',
};

export class OcrService {
  private scheduler: any = null;
  private worker: any = null;
  public isInitialized = false;

  async initialize(onProgress?: (progress: OcrProgress) => void) {
    if (this.isInitialized) {
      return;
    }

    try {
      if (onProgress) {
        onProgress({ status: 'Creating OCR engine...', progress: 0 });
      }

      // Create worker with better recognition settings
      this.worker = await createWorker('eng');
      await this.worker.setParameters({
        tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?\'"-', // Limit to expected characters
        tessedit_pageseg_mode: '6', // Assume uniform text block
        tessjs_create_pdf: '0',
        tessjs_create_hocr: '0',
        tessjs_create_tsv: '0',
        tessjs_create_box: '0',
        tessjs_create_unlv: '0',
        tessjs_create_osd: '0'
      });

      // Create scheduler and add worker
      this.scheduler = createScheduler();
      await this.scheduler.addWorker(this.worker);

      this.isInitialized = true;

      if (onProgress) {
        onProgress({ status: 'Ready', progress: 100 });
      }
    } catch (error) {
      this.isInitialized = false;
      await this.terminate();
      throw new Error('Failed to initialize OCR');
    }
  }

  private async preprocessImage(imageUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Set canvas size to match image
        canvas.width = img.width;
        canvas.height = img.height;

        // Draw original image
        ctx.drawImage(img, 0, 0);

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Convert to grayscale and increase contrast
        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          // Increase contrast
          const contrast = 1.5; // Adjust this value to increase/decrease contrast
          const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
          const newValue = factor * (avg - 128) + 128;
          
          // Apply threshold for better black/white separation
          const threshold = 128;
          const final = newValue > threshold ? 255 : 0;
          
          data[i] = final;     // R
          data[i + 1] = final; // G
          data[i + 2] = final; // B
        }

        // Put the modified image data back
        ctx.putImageData(imageData, 0, 0);

        // Convert to data URL
        resolve(canvas.toDataURL('image/png'));
      };

      img.onerror = () => reject(new Error('Failed to load image for preprocessing'));
      img.src = imageUrl;
    });
  }

  async recognizeImage(imageUrl: string): Promise<string> {
    if (!this.isInitialized || !this.scheduler || !this.worker) {
      throw new Error('OCR service not initialized');
    }

    try {
      // Preprocess the image
      const processedImageUrl = await this.preprocessImage(imageUrl);
      
      // Recognize text with improved settings
      const { data: { text } } = await this.scheduler.addJob('recognize', processedImageUrl);
      
      // Clean up the text
      return text.trim()
        .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
        .replace(/[^\w\s.,!?'"-]/g, ''); // Remove any unexpected characters
    } catch (error) {
      throw new Error('Failed to extract text from image');
    }
  }

  async terminate() {
    try {
      if (this.scheduler) {
        await this.scheduler.terminate();
        this.scheduler = null;
      }
      if (this.worker) {
        await this.worker.terminate();
        this.worker = null;
      }
      this.isInitialized = false;
    } catch (error) {
      console.error('Error terminating OCR service:', error);
    }
  }
}

export const ocrService = new OcrService();