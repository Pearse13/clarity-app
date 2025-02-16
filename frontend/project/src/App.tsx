import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import AuthError from './components/AuthError';

// Protected route component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth0();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
};

// Transform page component
const TransformPage: React.FC = () => {
  const { getAccessTokenSilently } = useAuth0();
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [transformType, setTransformType] = useState('simplify');
  const [transformLevel, setTransformLevel] = useState('3');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getLevelOptions = (type: string) => {
    switch(type) {
      case 'simplify':
        return [
          { value: '1', label: 'Level 1 - Explain this to a 10 year old' },
          { value: '2', label: 'Level 2 - Clear and Concise' },
          { value: '3', label: 'Level 3 - Cut and Dry' },
          { value: '4', label: 'Level 4 - Smoothed out' },
          { value: '5', label: 'Level 5 - Slightly simplified' }
        ];
      case 'sophisticate':
        return [
          { value: '1', label: 'Level 1 - Slightly Elevated' },
          { value: '2', label: 'Level 2 - Secondary School submittable' },
          { value: '3', label: 'Level 3 - Thoughtfully constructed' },
          { value: '4', label: 'Level 4 - University submittable' },
          { value: '5', label: 'Level 5 - Poetry in Motion' }
        ];
      case 'casualise':
        return [
          { value: '1', label: 'Level 1 - Slightly casual' },
          { value: '2', label: 'Level 2 - Relaxed' },
          { value: '3', label: 'Level 3 - Informal' },
          { value: '4', label: 'Level 4 - Very casual' },
          { value: '5', label: 'Level 5 - Super casual' }
        ];
      case 'formalise':
        return [
          { value: '1', label: 'Level 1 - Slightly formal' },
          { value: '2', label: 'Level 2 - Professional' },
          { value: '3', label: 'Level 3 - Business formal' },
          { value: '4', label: 'Level 4 - Very formal' },
          { value: '5', label: 'Level 5 - Highly formal' }
        ];
      default:
        return [];
    }
  };

  const handleTransform = async () => {
    try {
      // Input validation
      if (inputText.length > 250) {
        setError('Text cannot exceed 250 characters');
        return;
      }

      if (!inputText.trim()) {
        setError('Please enter some text to transform');
        return;
      }

      setIsLoading(true);
      setError(null);
      
      // Get the access token
      const token = await getAccessTokenSilently();
      
      const response = await fetch('http://localhost:8000/transformText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text: inputText,
          transformationType: transformType,
          level: parseInt(transformLevel)
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to transform text');
      }

      setOutputText(data.transformedText);
    } catch (err) {
      console.error('Transform error:', err);
      setError(
        err instanceof Error 
          ? err.message 
          : 'An error occurred while transforming the text. Please try again.'
      );
      setOutputText('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Input Column */}
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h2 className="text-2xl font-semibold mb-4">Input Text</h2>
          <textarea
            value={inputText}
            onChange={(e) => {
              const newText = e.target.value;
              if (newText.length <= 250) {
                setInputText(newText);
                setError(null);
              }
            }}
            placeholder="Enter your text here (max 250 characters)"
            className="w-full h-64 p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            maxLength={250}
            disabled={isLoading}
          />
          <div className="flex justify-between items-center mt-2">
            <p className={`text-sm ${inputText.length >= 250 ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
              {inputText.length}/250 characters
            </p>
            {inputText.length >= 225 && (
              <p className="text-amber-500 text-sm">
                Approaching character limit
              </p>
            )}
          </div>
        </div>

        {/* Output Column */}
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h2 className="text-2xl font-semibold mb-4">Output Text</h2>
          <div className="mb-4 flex gap-4">
            <select
              value={transformType}
              onChange={(e) => setTransformType(e.target.value)}
              className="flex-grow p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-96 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            <textarea
              value={error || outputText}
              readOnly
              placeholder="Transformed text will appear here"
              className={`w-full h-48 p-4 border rounded-lg bg-gray-50 resize-none transition-opacity duration-200 ${
                error ? 'text-red-500' : ''
              } ${isLoading ? 'opacity-50' : ''}`}
            />
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-lg">
                <div className="flex flex-col items-center gap-2">
                  <span className="inline-block animate-spin text-2xl">↻</span>
                  <span className="text-gray-600">Transforming your text...</span>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={handleTransform}
            disabled={!inputText.trim() || isLoading}
            className="w-full mt-4 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
          >
            {isLoading && <span className="inline-block animate-spin">↻</span>}
            {isLoading ? 'Transforming...' : 'Transform'}
          </button>
          {error && (
            <p className="mt-2 text-sm text-red-500">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const { loginWithRedirect, logout, isAuthenticated, user } = useAuth0();

  return (
    <div className="min-h-screen bg-background">
      <nav className="p-4 flex justify-between items-center bg-white/80 backdrop-blur-card shadow-sm">
        <div className="flex items-center gap-3">
          <img 
            src="/clarity-logo.jpg" 
            alt="Clarity Logo"
            className="w-8 h-8 object-cover rounded-lg" 
          />
          <span className="text-logo font-medium tracking-tight text-gray-900">Clarity</span>
        </div>
        <div className="flex items-center gap-4">
          {isAuthenticated && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-base text-gray-600">{user?.name || user?.email}</span>
              </div>
              <button
                onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                className="py-2 px-4 text-sm font-medium bg-white/80 backdrop-blur text-gray-900 rounded-xl hover:brightness-95 transition-all"
              >
                Logout
              </button>
            </>
          )}
        </div>
      </nav>

      <Routes>
        <Route path="/" element={
          <div className="container mx-auto px-4 py-18">
            <div className="max-w-3xl mx-auto text-center">
              <div className="space-y-6 mb-24">
                <h1 className="text-5xl font-medium tracking-tight text-gray-900 mb-16">
                  Your Personal AI Writing Assistant
                </h1>

                <button
                  onClick={() => loginWithRedirect({
                    authorizationParams: {
                      screen_hint: 'signup',
                      prompt: 'login',
                    },
                    appState: {
                      returnTo: '/transform'
                    }
                  })}
                  className="mb-16 py-5 px-14 text-xl font-medium bg-blue-600 text-white rounded-xl hover:brightness-95 transition-all shadow-sm hover:shadow-md"
                >
                  Try Clarity
                </button>
              </div>

              <div className="space-y-8">
                <p className="text-lg text-gray-700 tracking-tight">
                  Clarity is your AI-powered writing assistant, designed to transform your text effortlessly for any situation. Whether you're breaking down complex ideas, refining your language for a professional setting, or adjusting your tone to better connect with your audience, Clarity helps you communicate with confidence.
                </p>
                <div className="text-left">
                  <p className="text-lg text-gray-700 tracking-tight mb-6">
                    Choose from four powerful transformation modes:
                  </p>
                  <ul className="space-y-4 text-lg text-gray-700 tracking-tight mb-6">
                    <li className="flex items-start gap-3">
                      <span className="text-blue-500 text-xl">🔹</span>
                      <span><strong>Simplify</strong> – Makes text clearer and more accessible, ideal for teaching, learning, and general readability.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-blue-500 text-xl">🔹</span>
                      <span><strong>Sophisticate</strong> – Enhances vocabulary and structure for a more refined, academic, or professional tone.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-blue-500 text-xl">🔹</span>
                      <span><strong>Casualise</strong> – Creates a relaxed, approachable style, perfect for friendly or engaging communication.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-blue-500 text-xl">🔹</span>
                      <span><strong>Formalise</strong> – Polishes text for professionalism, ensuring clarity and appropriateness in business or official settings.</span>
                    </li>
                  </ul>
                  <p className="text-lg text-gray-700 tracking-tight">
                    With five intensity levels for each mode, you have full control over how much your text evolves. Simply enter up to 250 characters, select your transformation style and level, and let Clarity refine your writing with precision.
                  </p>
                </div>
              </div>

              <div className="mt-24 text-lg text-gray-700 tracking-tight italic border-t pt-8">
                Clarity is currently in beta, and we are continuously improving its accuracy, capabilities, and user experience.
              </div>
            </div>
          </div>
        } />
        <Route path="/transform" element={
            <ProtectedRoute>
            <TransformPage />
            </ProtectedRoute>
        } />
        <Route path="/callback" element={<AuthError />} />
      </Routes>
    </div>
  );
};

export default App;