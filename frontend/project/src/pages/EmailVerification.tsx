import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Navigate } from 'react-router-dom';

export const EmailVerification: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth0();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" />;
  }

  // If email is verified, redirect to welcome page
  if (user?.email_verified) {
    return <Navigate to="/welcome" />;
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-6">
      <div className="max-w-md w-full p-8 bg-white rounded-2xl shadow-sm space-y-6">
        <h1 className="text-2xl font-medium text-gray-900">Verify Your Email</h1>
        <p className="text-gray-600">
          Please check your email ({user?.email}) and click the verification link to continue.
        </p>
        <p className="text-gray-600">
          After verifying your email, you can refresh this page or click the button below.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="w-full py-3 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
        >
          I've Verified My Email
        </button>
      </div>
    </div>
  );
};

export default EmailVerification;