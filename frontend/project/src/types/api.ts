export interface ApiError {
  status: number;
  message: string;
  detail?: string;
}

export interface TransformRequest {
  text: string;
  transformationType: 'simplify' | 'sophisticate' | 'casualise';
  level: number;
  model: 'gpt-4' | 'gpt-3.5-turbo';
  isLecture?: boolean;
  options?: {
    temperature?: number;     // Control randomness (0.0 to 1.0)
    maxTokens?: number;      // Maximum tokens in response
    presence_penalty?: number; // Penalty for topic repetition
    instruction?: string;     // Specific instructions for the model
    stream?: boolean;        // Enable streaming response
  };
}

export interface TransformResponse {
  transformedText: string;
  originalText?: string;
  transformationType?: string;
  level?: number;
  model?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// Add streaming callback type
export type StreamProgressCallback = (text: string) => void;

export class ApiRequestError extends Error {
  constructor(public error: ApiError) {
    super(error.message);
    this.name = 'ApiRequestError';
  }
}

export const isApiError = (error: unknown): error is ApiError => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    'message' in error
  );
}; 