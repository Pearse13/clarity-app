import React, { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate, useLocation } from 'react-router-dom';

export const LoginError: React.FC = () => {
  const { loginWithRedirect } = useAuth0();
  const [isLoading, setIsLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const errorMessage = location.state?.error || 'An error occurred during login. Please try again.';

  const handleRetry = async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      // Clear browser storage before retry
      localStorage.clear();
      sessionStorage.clear();
      
      await loginWithRedirect({
        appState: {
          returnTo: '/transform'
        },
        authorizationParams: {
          prompt: 'login',
          screen_hint: 'login'
        }
      });
    } catch (err) {
      console.error('Login retry error:', err);
      setIsLoading(false);
      navigate('/login', { state: { error: 'Login retry failed. Please try again.' } });
    }
  };

  const handleSignUp = () => {
    loginWithRedirect({
      authorizationParams: {
        screen_hint: 'signup'
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-6">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8">
        {/* Left Column - Branding */}
        <div className="flex flex-col justify-center space-y-8">
          <div className="flex items-center gap-3">
            <img 
              src="/clarity-logo.jpg" 
              alt="Clarity Logo"
              className="w-12 h-12 object-cover rounded-lg" 
            />
            <h1 className="text-[2.5rem] font-medium tracking-tight text-gray-900">
              Clarity
            </h1>
          </div>
          <p className="text-xl text-gray-600 tracking-tight">
            Enhance your learning journey with AI-powered study tools designed to help you achieve clarity in your understanding.
          </p>
        </div>

        {/* Right Column - Login Form */}
        <div className="flex items-center">
          <div className="w-full p-8 rounded-2xl bg-white/80 backdrop-blur-xl shadow-sm space-y-8">
            <div className="space-y-2">
              <h2 className="text-2xl font-medium text-gray-900">Login Failed</h2>
              <p className="text-gray-600">Please check your credentials and try again</p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600">{errorMessage}</p>
            </div>

            <div className="space-y-4">
              <button 
                onClick={handleRetry}
                className="w-full py-3 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center gap-2"
                disabled={isLoading}
              >
                {isLoading ? 'Trying again...' : 'Try Again'}
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white/80 text-gray-500">or</span>
                </div>
              </div>

              <button 
                onClick={handleSignUp}
                className="w-full py-3 px-4 bg-white border border-gray-200 text-gray-900 rounded-xl hover:bg-gray-50 transition-colors duration-200 flex items-center justify-center gap-2"
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Create an account'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginError; 