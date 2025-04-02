import { TransformationType } from './transform';

export interface TokenUsage {
  completion_tokens: number;
  prompt_tokens: number;
  total_tokens: number;
  completion_tokens_details?: {
    accepted_prediction_tokens: number;
    audio_tokens: number;
    reasoning_tokens: number;
    rejected_prediction_tokens: number;
  };
  prompt_tokens_details?: {
    audio_tokens: number;
    cached_tokens: number;
  };
}

export interface TransformResponse {
  transformedText: string;
  transformationType: TransformationType;
  level: number;
  usage?: TokenUsage;
}

export interface ApiError {
  detail: string;
  code?: string;
  status?: number;
}

// Validation functions
export const isTransformResponse = (data: unknown): data is TransformResponse => {
  if (!data || typeof data !== 'object') return false;
  
  const response = data as Partial<TransformResponse>;
  return (
    typeof response.transformedText === 'string' &&
    typeof response.transformationType === 'string' &&
    typeof response.level === 'number'
  );
};

export const isApiError = (data: unknown): data is ApiError => {
  if (!data || typeof data !== 'object') return false;
  
  const error = data as Partial<ApiError>;
  return typeof error.detail === 'string';
};

export interface TransformRequest {
  text: string;
  transformationType: 'simplify' | 'sophisticate' | 'casualise' | 'formalise';
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

// Add streaming callback type
export type StreamProgressCallback = (text: string) => void;

export class ApiRequestError extends Error {
  constructor(public error: ApiError) {
    super(error.detail);
    this.name = 'ApiRequestError';
  }
} 