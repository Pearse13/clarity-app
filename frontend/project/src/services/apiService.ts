import axios from 'axios';
import config from '../config';

// Define types for API requests and responses
export type TransformationType = 'simplify' | 'sophisticate' | 'casualise' | 'formalise';

export interface TransformRequestData {
  text: string;
  transformationType: TransformationType;
  level: number;
  isLecture?: boolean;
  documentText?: string;
}

export interface TransformResponseData {
  transformedText: string;
  transformationType: TransformationType;
  level: number;
  usage_info: {
    tokens_used: number;
    model: string;
    context_applied: boolean;
  };
  context_applied: boolean;
}

// Creates and configures an axios instance with default settings
const api = axios.create({
  baseURL: config.apiUrl,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
});

// Set up API key if available
if (process.env.REACT_APP_API_KEY) {
  api.defaults.headers.common['X-API-Key'] = process.env.REACT_APP_API_KEY;
}

/**
 * Transform text using the Clarity API
 * @param text - Text to be transformed
 * @param transformationType - Type of transformation to apply
 * @param level - Level of transformation (1-5)
 * @param isLecture - Whether this is a lecture transformation
 * @param documentText - Optional full document text for context
 * @returns Promise with the transformed text response
 */
export const transformText = async (
  text: string,
  transformationType: TransformationType,
  level: number,
  isLecture: boolean = false,
  documentText?: string
): Promise<TransformResponseData> => {
  try {
    const requestData: TransformRequestData = {
      text,
      transformationType,
      level,
      isLecture
    };

    // Add document text for context if provided
    if (documentText) {
      requestData.documentText = documentText;
    }

    const response = await api.post<TransformResponseData>('/transform', requestData);
    return response.data;
  } catch (error) {
    console.error('Error transforming text:', error);
    throw error;
  }
};

// Health check endpoint to verify API connectivity
export const checkApiHealth = async (): Promise<{ status: string }> => {
  try {
    const response = await api.get('/health');
    return response.data;
  } catch (error) {
    console.error('API health check failed:', error);
    throw error;
  }
}; 