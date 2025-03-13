import React, { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { API_URL } from '../config/api';
import DashboardLayout from '../components/DashboardLayout';

const CHARACTER_LIMIT = 250;

const TransformPage: React.FC = () => {
  const { getAccessTokenSilently, loginWithRedirect } = useAuth0();
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
      const response = await fetch(`${API_URL}/health`, { 
        method: 'GET', 
        headers: { 'Content-Type': 'application/json' } 
      });
      
      if (response.ok) {
        setError('✅ API connection successful! The server is reachable.');
      } else {
        setError(`❌ API server is reachable but returned status ${response.status}. The server might be experiencing issues.`);
      }
    } catch (err: unknown) {
      console.error('API connection test failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`❌ Cannot connect to API server at ${API_URL}. ${errorMessage}`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Rest of your transform page code...
  const getLevelOptions = (type: string) => {
    switch(type) {
      case 'simplify':
        return [
          { value: 1, label: 'Age 7-8', description: 'Basic words and very short sentences' },
          { value: 2, label: 'Age 10-11', description: 'Simple words with some subject-specific terms' },
          { value: 3, label: 'Age 13-14', description: 'Moderate vocabulary with mixed sentence structure' },
          { value: 4, label: 'GCSE Level', description: 'Standard vocabulary with technical terms' },
          { value: 5, label: 'A-Level', description: 'Clear but academically sophisticated' }
        ];
      case 'sophisticate':
        return [
          { value: 1, label: 'Professional', description: 'Business language with moderate formality' },
          { value: 2, label: 'Academic Undergraduate', description: 'Scholarly tone with theoretical concepts' },
          { value: 3, label: 'Academic Graduate', description: 'Advanced concepts and field-specific terms' },
          { value: 4, label: 'Expert/Specialist', description: 'Technical language and complex frameworks' },
          { value: 5, label: 'Advanced Academic', description: 'Sophisticated academic publication style' }
        ];
      case 'casualise':
        return [
          { value: 1, label: 'Level 1 - Polite Casual' },
          { value: 2, label: 'Level 2 - Relaxed' },
          { value: 3, label: 'Level 3 - Very Casual' },
          { value: 4, label: 'Level 4 - Super Casual' },
          { value: 5, label: 'Level 5 - Ultra Casual' }
        ];
      case 'formalise':
        return [
          { value: 1, label: 'Level 1 - Basic Professional' },
          { value: 2, label: 'Level 2 - Business Formal' },
          { value: 3, label: 'Level 3 - Executive Level' },
          { value: 4, label: 'Level 4 - Legal/Corporate' },
          { value: 5, label: 'Level 5 - Diplomatic/Governmental' }
        ];
      default:
        return [];
    }
  };

  const handleError = (err: Error) => {
    if (err.message?.includes('Missing Refresh Token')) {
      setError('Your session has expired. Please log in again.');
      // Redirect to login after a short delay
      setTimeout(() => {
        loginWithRedirect({
          appState: { returnTo: window.location.pathname }
        });
      }, 2000);
      return;
    }
    
    setError('Unable to process text at the moment. Please try again.');
  };

  const handleTransform = async () => {
    if (!inputText.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: 'openid profile email offline_access'
        }
      });

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/transform`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text: inputText,
          transformationType: transformType,
          level: parseInt(transformLevel),
          isLecture: false  // Indicate this is not a lecture request
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Transform request failed');
      }

      setOutputText(data.transformedText);
    } catch (err: any) {
      console.error('Transform error:', err);
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-6">
          <img 
            src="/clarity-logo.jpg" 
            alt="Clarity Logo" 
            className="w-8 h-8 object-contain"
          />
          <h1 className="text-2xl font-semibold">Clarity Text Transformer</h1>
        </div>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Input Column */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">Input Text</h2>
            <textarea
              value={inputText}
              onChange={(e) => {
                const newText = e.target.value;
                if (newText.length <= CHARACTER_LIMIT) {
                  setInputText(newText);
                  setError(null);
                }
              }}
              placeholder={`Enter your text here (max ${CHARACTER_LIMIT} characters)`}
              className="w-full h-64 p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none
                       dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:placeholder-gray-400"
              maxLength={CHARACTER_LIMIT}
              disabled={isLoading}
            />
            <div className="flex justify-between items-center mt-2">
              <p className={`text-sm ${inputText.length >= CHARACTER_LIMIT ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                {inputText.length}/{CHARACTER_LIMIT} characters
              </p>
              {inputText.length >= CHARACTER_LIMIT - 25 && (
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