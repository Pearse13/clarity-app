import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';

export const AuthButton: React.FC = () => {
  const { loginWithRedirect, logout, isAuthenticated } = useAuth0();

  if (isAuthenticated) {
    return (
      <button
        onClick={() => logout()}
        className="py-2 px-4 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors"
      >
        Log Out
      </button>
    );
  }

  return (
    <div className="space-x-4">
      <button
        onClick={() => loginWithRedirect({
          appState: { returnTo: window.location.pathname },
          authorizationParams: {
            screen_hint: 'signup',
            prompt: 'login'
          }
        })}
        className="py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Sign Up
      </button>
      <button
        onClick={() => loginWithRedirect({
          appState: { returnTo: window.location.pathname }
        })}
        className="py-2 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
      >
        Log In
      </button>
    </div>
  );
};

export default AuthButton;