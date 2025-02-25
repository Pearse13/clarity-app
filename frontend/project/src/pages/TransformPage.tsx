import React, { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import * as Sentry from "@sentry/react";
import { apiService } from '../services/api';
import { rateLimiter } from '../utils/rateLimiter';
import LoadingSpinner from '../components/LoadingSpinner';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { ApiRequestError, TransformRequest } from '../types/api';
import { API_URL } from '../config/api';
import DashboardLayout from '../components/DashboardLayout';

const TransformPage: React.FC = () => {
  const { getAccessTokenSilently } = useAuth0();
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [transformType, setTransformType] = useState('simplify');
  const [transformLevel, setTransformLevel] = useState('3');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // Add keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'Enter',
      ctrlKey: true,
      handler: () => {
        if (!isLoading && inputText.trim()) {
          handleTransform();
        }
      },
      preventDefault: true
    }
  ]);

  // New function to test API connectivity
  const testApiConnection = async () => {
    setIsTestingConnection(true);
    setError(null);
    
    try {
      // Simple fetch to the API base URL to check if it's responding
      const response = await fetch(`${API_URL}/health`, { 
        method: 'GET', 
        headers: { 'Content-Type': 'application/json' } 
      });
      
      if (response.ok) {
        setError('✅ API connection successful! The server is reachable.');
      } else {
        setError(`❌ API server is reachable but returned status ${response.status}. The server might be experiencing issues.`);
      }
    } catch (err) {
      console.error('API connection test failed:', err);
      setError(`❌ Cannot connect to API server at ${API_URL}. The server might be down or your network connection is interrupted.`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Rest of your transform page code...
  const getLevelOptions = (type: string) => {
    switch(type) {
      case 'simplify':
        return [
          { value: '1', label: 'Level 1 - Elementary (Age 7-8)' },
          { value: '2', label: 'Level 2 - Middle School (Age 11-12)' },
          { value: '3', label: 'Level 3 - High School (Age 14-15)' },
          { value: '4', label: 'Level 4 - College Freshman' },
          { value: '5', label: 'Level 5 - General Adult' }
        ];
      case 'sophisticate':
        return [
          { value: '1', label: 'Level 1 - Professional' },
          { value: '2', label: 'Level 2 - Academic Undergraduate' },
          { value: '3', label: 'Level 3 - Academic Graduate' },
          { value: '4', label: 'Level 4 - Expert/Specialist' },
          { value: '5', label: 'Level 5 - Advanced Academic' }
        ];
      case 'casualise':
        return [
          { value: '1', label: 'Level 1 - Polite Casual' },
          { value: '2', label: 'Level 2 - Relaxed' },
          { value: '3', label: 'Level 3 - Very Casual' },
          { value: '4', label: 'Level 4 - Super Casual' },
          { value: '5', label: 'Level 5 - Ultra Casual' }
        ];
      case 'formalise':
        return [
          { value: '1', label: 'Level 1 - Basic Professional' },
          { value: '2', label: 'Level 2 - Business Formal' },
          { value: '3', label: 'Level 3 - Executive Level' },
          { value: '4', label: 'Level 4 - Legal/Corporate' },
          { value: '5', label: 'Level 5 - Diplomatic/Governmental' }
        ];
      default:
        return [];
    }
  };

  const handleTransform = async () => {
    try {
      // Input validation
      if (!inputText.trim()) {
        setError('Please enter some text to transform');
        return;
      }

      if (inputText.length > 250) {
        setError('Text cannot exceed 250 characters');
        return;
      }

      // Rate limiting check with better error message
      if (!rateLimiter.canMakeRequest()) {
        const waitTime = rateLimiter.getTimeUntilNextRequest();
        setError(`Please wait ${Math.ceil(waitTime / 1000)} seconds before trying again`);
        return;
      }

      setIsLoading(true);
      setError(null);
      
      // Get token with improved error handling
      let token;
      try {
        token = await getAccessTokenSilently({
          authorizationParams: {
            audience: import.meta.env.VITE_AUTH0_AUDIENCE,
            scope: 'openid profile email offline_access'
          }
        });
        console.log('Got access token for API request');
      } catch (tokenError) {
        console.error('Failed to get access token:', tokenError);
        
        // Try logging out and back in if there's a token issue
        if (tokenError instanceof Error && 
            (tokenError.message.includes('Missing Refresh Token') || 
             tokenError.message.includes('invalid_grant'))) {
          setError('Authentication session expired. Please log out and log back in.');
          setIsLoading(false);
          return;
        }
        throw tokenError;
      }

      const request: TransformRequest = {
        text: inputText,
        transformationType: transformType as TransformRequest['transformationType'],
        level: parseInt(transformLevel)
      };
      
      try {
        const response = await apiService.transformText(request, token);
        setOutputText(response.transformedText);
        rateLimiter.addRequest(); // Only add request after successful transformation
      } catch (apiError) {
        console.error('API request failed:', apiError);
        
        if (apiError instanceof ApiRequestError) {
          // Show detailed error with troubleshooting steps
          const errorDetail = apiError.error.detail || '';
          const serverError = apiError.error.status === 500;
          
          let errorMessage = apiError.error.message || 'API request failed';
          let troubleshooting = '';
          
          // Check for OpenAI API connection errors specifically
          if (errorDetail.includes('OpenAI API error: Connection error')) {
            errorMessage = 'OpenAI API Connection Error';
            troubleshooting = '\n\nThe server cannot connect to OpenAI. This could be due to:\n\n' +
              '1. OpenAI API may be experiencing downtime\n' +
              '2. The server\'s OpenAI API key may be invalid or expired\n' +
              '3. Network connectivity issues on the server\n\n' +
              'Troubleshooting:\n' +
              '• Try again in a few minutes\n' +
              '• Contact the administrator as the API key may need to be updated\n' +
              '• Check OpenAI status page at status.openai.com';
          }
          // General server error
          else if (serverError) {
            errorMessage = `Server error: ${errorMessage}. Our team has been notified of this issue.`;
            troubleshooting = '\n\nTroubleshooting steps:\n1. Try with different text\n2. Try a different transformation type\n3. Contact support if the issue persists';
          }
          // Connection errors
          else if (errorDetail.includes('Connection error') || errorDetail.includes('Failed to connect')) {
            troubleshooting = '\n\nTroubleshooting steps:\n1. Check your internet connection\n2. Verify the API server is running\n3. Try again in a few minutes';
          }
          
          setError(`${errorMessage}${errorDetail ? `\n\nDetails: ${errorDetail}` : ''}${troubleshooting}`);
        } else {
          setError('An unexpected error occurred. Please try again.');
        }
        throw apiError; // Re-throw to be caught by the outer catch
      }
      
    } catch (err) {
      console.error('Transform error:', err);
      
      if (import.meta.env.VITE_ENV === 'production') {
        Sentry.captureException(err);
      }
      
      // Only set error if not already set by one of the inner catch blocks
      if (!error) {
        if (err instanceof ApiRequestError) {
          setError(err.error.detail || err.error.message || 'API request failed');
        } else if (err instanceof Error) {
          setError(err.message || 'An unexpected error occurred');
        } else {
          setError('An unexpected error occurred. Please try again.');
        }
      }
      
      setOutputText('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex-1">
        <h1 className="text-2xl font-semibold">Transform Text</h1>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Input Column */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">Input Text</h2>
            <textarea
              value={inputText}
              onChange={(e) => {
                const newText = e.target.value;
                if (newText.length <= 250) {
                  setInputText(newText);
                  setError(null);
                }
              }}
              placeholder="Enter your text here (max 250 characters)"
              className="w-full h-64 p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none
                       dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:placeholder-gray-400"
              maxLength={250}
              disabled={isLoading}
            />
            <div className="flex justify-between items-center mt-2">
              <p className={`text-sm ${inputText.length >= 250 ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                {inputText.length}/250 characters
              </p>
              {inputText.length >= 225 && (
                <p className="text-amber-500 dark:text-amber-400 text-sm">
                  Approaching character limit
                </p>
              )}
            </div>
          </div>

          {/* Output Column */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">Output Text</h2>
            <div className="mb-4 flex gap-4">
              <select
                value={transformType}
                onChange={(e) => setTransformType(e.target.value)}
                className="flex-grow p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         dark:bg-gray-700 dark:text-white dark:border-gray-600"
                disabled={isLoading}
              >
                <option value="simplify">Simplify</option>
                <option value="sophisticate">Sophisticate</option>
                <option value="casualise">Casualise</option>
                <option value="formalise">Formalise</option>
              </select>
              <select
                value={transformLevel}
                onChange={(e) => setTransformLevel(e.target.value)}
                className="w-96 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         dark:bg-gray-700 dark:text-white dark:border-gray-600"
                disabled={isLoading}
              >
                {getLevelOptions(transformType).map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative">
              {error ? (
                <div className="w-full h-48 p-4 border rounded-lg bg-gray-50 dark:bg-gray-700 overflow-y-auto
                            dark:text-white dark:border-gray-600">
                  <p className="text-red-500 dark:text-red-400 whitespace-pre-line">{error}</p>
                </div>
              ) : (
                <textarea
                  value={outputText}
                  readOnly
                  placeholder="Transformed text will appear here"
                  className={`w-full h-48 p-4 border rounded-lg bg-gray-50 dark:bg-gray-700 resize-none transition-opacity duration-200
                           dark:text-white dark:border-gray-600 dark:placeholder-gray-400
                           ${isLoading ? 'opacity-50' : ''}`}
                />
              )}
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-800 bg-opacity-75 dark:bg-opacity-75 rounded-lg">
                  <LoadingSpinner message="Transforming your text..." />
                </div>
              )}
              {isTestingConnection && (
                <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-800 bg-opacity-75 dark:bg-opacity-75 rounded-lg">
                  <LoadingSpinner message="Testing API connection..." />
                </div>
              )}
            </div>
            <button
              onClick={handleTransform}
              disabled={!inputText.trim() || isLoading || isTestingConnection}
              className="w-full mt-4 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                       transition-colors disabled:opacity-50 disabled:cursor-not-allowed 
                       flex justify-center items-center gap-2"
            >
              {isLoading && <LoadingSpinner size="sm" />}
              {isLoading ? 'Transforming...' : 'Transform (Ctrl + Enter)'}
            </button>
            
            <div className="mt-4 flex justify-between items-center">
              <button
                onClick={testApiConnection}
                disabled={isLoading || isTestingConnection}
                className="px-4 py-2 text-sm bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300
                         dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {isTestingConnection ? 'Testing...' : 'Test API Connection'}
              </button>
              
              {error && (
                <button
                  onClick={() => setError(null)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                >
                  Clear Message
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TransformPage; 