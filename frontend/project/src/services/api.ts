import axios from 'axios';
import { ApiRequestError, StreamProgressCallback } from '../types/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export type TransformType = 'simplify' | 'sophisticate' | 'casualise' | 'formalise';

interface TransformRequest {
  text: string;
  transformType: TransformType;
  level: number;
  isLecture?: boolean;
}

interface TransformResponse {
  transformedText: string;
  transformationType: TransformType;
  level: number;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

class ApiService {
  private onProgress: StreamProgressCallback | null = null;

  setProgressCallback(callback: StreamProgressCallback) {
    this.onProgress = callback;
  }

  async transformText(request: TransformRequest): Promise<TransformResponse> {
    console.log('Transform request:', request);
    try {
      const response = await axios.post<TransformResponse>(
        `${API_BASE_URL}/api/transform`,
        request
      );
      return response.data;
    } catch (error) {
      console.error('Error transforming text:', error);
      throw error;
    }
  }
}

export default new ApiService(); 