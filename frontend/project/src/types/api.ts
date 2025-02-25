export interface ApiError {
  status: number;
  message: string;
  detail?: string;
}

export interface TransformRequest {
  text: string;
  transformationType: 'simplify' | 'sophisticate' | 'casualise' | 'formalise';
  level: number;
}

export interface TransformResponse {
  transformedText: string;
  originalText?: string;
  transformationType?: string;
  level?: number;
}

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