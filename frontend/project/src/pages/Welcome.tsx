import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const Welcome: React.FC = () => {
  const { loginWithRedirect } = useAuth0();

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-6">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8">
        {/* Left Column - Branding */}
        <div className="flex flex-col justify-center space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-600 rounded-lg shadow-md flex items-center justify-center text-white font-bold text-xl">
              C
            </div>
            <h1 className="text-[2.5rem] font-medium tracking-tight text-gray-900">
              Clarity
            </h1>
          </div>
          <div className="flex flex-col space-y-2">
            <p className="text-xl font-medium text-gray-600 tracking-tight">
              Understand it First
            </p>
          </div>
        </div>

        {/* Right Column - Welcome Card */}
        <div className="flex items-center">
          <div className="bg-white/80 backdrop-blur-xl w-full p-8 rounded-2xl shadow-sm space-y-8">
            <div className="space-y-2">
              <h2 className="text-2xl font-medium text-gray-900">Welcome to Clarity</h2>
              <p className="text-gray-600">Experience the power of AI-enhanced learning</p>
            </div>

            <button 
              onClick={() => {
                try {
                  loginWithRedirect({
                    appState: {
                      returnTo: '/transform'
                    }
                  });
                } catch (error) {
                  console.error('Login error:', error);
                }
              }} 
              className="w-full py-3 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors duration-200 font-medium"
            >
              Try Clarity
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Welcome; 