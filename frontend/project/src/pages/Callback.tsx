import React, { useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate, useLocation } from 'react-router-dom';

export const Callback: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth0();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const error = params.get('error');
    const errorDescription = params.get('error_description');

    if (error) {
      // Handle specific error types
      switch (error) {
        case 'invalid_grant':
        case 'invalid_user_password':
        case 'invalid_credentials':
        case 'invalid_request':
          navigate('/login', { 
            state: { 
              error: 'Invalid email or password. Please try again.' 
            },
            replace: true
          });
          break;
        case 'unauthorized':
        case 'access_denied':
        case 'consent_required':
          navigate('/login', { 
            state: { 
              error: 'Your account is not authorized. Please check your credentials.' 
            },
            replace: true
          });
          break;
        case 'login_required':
          navigate('/login', {
            state: {
              error: 'Please log in to continue.'
            },
            replace: true
          });
          break;
        default:
          navigate('/login', { 
            state: { 
              error: errorDescription || 'An error occurred during login. Please try again.' 
            },
            replace: true
          });
      }
      return;
    }

    if (!isLoading && isAuthenticated) {
      navigate('/transform', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, location]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
      <div className="text-xl text-gray-600">Completing login...</div>
    </div>
  );
};

export default Callback; 