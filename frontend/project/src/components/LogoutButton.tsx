import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';

export const LogoutButton: React.FC = () => {
  const { logout } = useAuth0();
  
  const handleLogout = () => {
    logout({ 
      logoutParams: { 
        returnTo: window.location.origin + '/login'
      }
    });
  };
  
  return (
    <button
      onClick={handleLogout}
      className="fixed top-4 right-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors duration-200"
    >
      Logout
    </button>
  );
}; 