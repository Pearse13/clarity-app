import React from 'react';
// import { FallbackProps } from '@sentry/react';

interface FallbackProps {
  error: Error;
  resetError?: () => void;
}

const ErrorFallback: React.FC<FallbackProps> = ({ 
  error, 
  resetError 
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white p-6 rounded-xl shadow-sm max-w-lg w-full space-y-4">
        <h2 className="text-2xl font-semibold text-gray-900">Something went wrong</h2>
        <p className="text-gray-600">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh Page
          </button>
          {resetError && (
            <button
              onClick={resetError}
              className="px-4 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorFallback; 