import React, { useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate, useLocation } from 'react-router-dom';

const Callback: React.FC = () => {
  const { isAuthenticated, isLoading, error } = useAuth0();
  const navigate = useNavigate();
  const location = useLocation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<'processing' | 'success' | 'error' | 'redirecting'>('processing');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const authError = params.get('error');
    const errorDescription = params.get('error_description');
    
    // Handle explicit errors from Auth0
    if (authError) {
      setErrorMessage(`Auth0 Error: ${authError}${errorDescription ? ` - ${errorDescription}` : ''}`);
      setStatus('error');
      console.error('Auth0 error from URL params:', authError, errorDescription);
    } 
    // Handle errors from Auth0 hook
    else if (error) {
      setErrorMessage(`Auth0 Error: ${error.message}`);
      setStatus('error');
      console.error('Auth0 error from hook:', error);
    } 
    // Handle successful authentication
    else if (!isLoading && isAuthenticated) {
      setStatus('success');
      console.log('Authentication successful, preparing redirect...');
      
      // Give user visual feedback before redirect
      setTimeout(() => {
        setStatus('redirecting');
        // Clear any existing history and redirect to transform
        window.history.replaceState(null, '', '/transform');
        navigate('/transform', { replace: true });
      }, 1000);
    }
  }, [isLoading, isAuthenticated, navigate, error, location.search]);

  if (errorMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-6 bg-white shadow-md rounded-lg">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Authentication Error</h2>
          <p className="text-gray-700 mb-4">{errorMessage}</p>
          <p className="text-gray-600 mb-6">
            Please try again or contact support if the issue persists.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate('/', { replace: true })}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Return to Home
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="w-full py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
            >
              Start Over
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        {status === 'processing' && (
          <>
            <div className="animate-spin text-4xl mb-4">↻</div>
            <p className="text-gray-600">Authenticating...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-green-500 text-4xl mb-4">✓</div>
            <p className="text-gray-600">Authentication successful!</p>
            <p className="text-gray-400 mt-2">Redirecting you to Clarity...</p>
          </>
        )}
        {status === 'redirecting' && (
          <>
            <div className="animate-spin text-4xl mb-4">↻</div>
            <p className="text-gray-600">Redirecting...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default Callback; 