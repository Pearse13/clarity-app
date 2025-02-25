import { API_ENDPOINTS } from '../config/api';
// import { ApiError, ApiRequestError, TransformRequest, TransformResponse } from '../types/api';
import { ApiRequestError, TransformRequest, TransformResponse } from '../types/api';

class ApiService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    try {
      console.log(`Making request to: ${endpoint}`);
      
      const response = await fetch(endpoint, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      // Log response status
      console.log(`Response status: ${response.status}`);
      
      let data;
      try {
        // Check if response is empty before parsing JSON
        const text = await response.text();
        console.log('Response raw text:', text.slice(0, 200) + (text.length > 200 ? '...' : ''));
        data = text.length > 0 ? JSON.parse(text) : {};
        console.log('Response data:', data);
      } catch (jsonError) {
        console.error('Error parsing JSON response:', jsonError);
        throw new ApiRequestError({
          status: response.status,
          message: 'Failed to parse server response',
          detail: jsonError instanceof Error ? jsonError.message : 'Invalid JSON'
        });
      }

      if (!response.ok) {
        console.error('API error:', data);
        
        // Special handling for 500 errors
        if (response.status === 500) {
          throw new ApiRequestError({
            status: 500,
            message: 'Server error',
            detail: data.detail || data.message || 'The server encountered an internal error. Please try again later or contact support if the issue persists.'
          });
        }
        
        throw new ApiRequestError({
          status: response.status,
          message: data.message || 'An error occurred',
          detail: data.detail || `Server returned ${response.status}`
        });
      }

      return data;
    } catch (error) {
      console.error('Request error:', error);
      
      if (error instanceof ApiRequestError) {
        throw error;
      }
      
      // Network errors or unexpected errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Network or unexpected error:', errorMessage);
      
      throw new ApiRequestError({
        status: 500,
        message: 'Connection error',
        detail: `Failed to connect to the API: ${errorMessage}. Please check your internet connection or try again later.`
      });
    }
  }

  async transformText(
    request: TransformRequest,
    token: string
  ): Promise<TransformResponse> {
    console.log('Transform request:', request);
    try {
      return this.request<TransformResponse>(API_ENDPOINTS.transform, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(request),
      });
    } catch (error) {
      console.error('Transform text error:', error);
      throw error;
    }
  }
}

export const apiService = new ApiService(); 