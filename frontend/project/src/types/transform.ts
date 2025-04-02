export type TransformationType = 'simplify' | 'sophisticate' | 'casualise';

export interface TransformRequest {
  text: string;
  transformationType: TransformationType;
  level: number;
  isLecture?: boolean;
}

export interface TransformResponse {
  transformedText: string;
  originalText: string;
  transformationType: TransformationType;
  level: number;
} 