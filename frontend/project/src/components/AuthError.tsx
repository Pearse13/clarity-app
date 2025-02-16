import React, { useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const AuthError: React.FC = () => {
  const { logout } = useAuth0();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'access_denied') {
      // Only handle the access_denied case
      logout({ 
        logoutParams: {
          returnTo: window.location.origin
        }
      });
    }
  }, [logout]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
};

export default AuthError; 