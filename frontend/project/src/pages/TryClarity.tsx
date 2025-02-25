import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const FeatureCard: React.FC<{ title: string; description: string; icon: JSX.Element; isLarge?: boolean }> = ({ 
  title, 
  description,
  icon,
  isLarge = false
}) => (
  <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-card p-5 rounded-xl shadow-sm">
    <div className="text-blue-600 dark:text-blue-400 mb-3">
      {icon}
    </div>
    <h3 className={`${isLarge ? 'text-xl' : 'text-lg'} font-medium text-gray-900 dark:text-white mb-2`}>{title}</h3>
    <p className="text-gray-600 dark:text-gray-300">{description}</p>
  </div>
);

const TryClarity: React.FC = () => {
  const { loginWithRedirect } = useAuth0();

  const handleLogin = async () => {
    try {
      console.log('Starting login process...');
      console.log('Auth0 login configuration:', {
        domain: import.meta.env.VITE_AUTH0_DOMAIN,
        clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
        appState: { returnTo: '/transform' }
      });
      
      await loginWithRedirect({
        appState: { returnTo: '/transform' },
        authorizationParams: {
          prompt: 'login',
          response_type: 'code',
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: 'openid profile email offline_access'
        }
      });
      console.log('Login redirect initiated');
    } catch (error) {
      console.error('Login redirect error:', error);
      const errorMessage = (error instanceof Error) 
        ? `${error.name}: ${error.message}` 
        : 'Unknown error';
      console.error('Detailed error info:', errorMessage);
      alert('Login failed: ' + errorMessage);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-gray-900 flex flex-col">
      {/* Hero Section */}
      <div className="flex flex-col items-center justify-center px-6 pt-14 pb-16">
        <div className="flex items-center gap-2 mb-6">
          <h1 className="text-[5.1rem] font-medium tracking-tight text-gray-900 dark:text-white">
            Clarity API
          </h1>
        </div>
        <p className="text-xl text-black dark:text-white text-center max-w-2xl mb-6 text-[1.93em] font-semibold">
          Understand it First
        </p>
        <p className="text-xl text-gray-600 dark:text-gray-300 text-center max-w-2xl mb-20">
          Transforming your unique learning experience with Clarity API
        </p>
        <button 
          onClick={handleLogin}
          className="px-16 py-8 bg-blue-600 text-white text-3xl rounded-xl hover:bg-blue-700 transition-colors duration-200 font-medium shadow-lg"
        >
          Try Clarity
        </button>
        <p className="mt-4 text-gray-600 dark:text-gray-400 text-center">
          Sign in with Google or email to continue
        </p>
      </div>

      {/* Spacer */}
      <div className="py-16"></div>

      {/* Clarity.Lecture Section */}
      <h2 className="text-4xl font-medium text-gray-900 dark:text-white text-center mb-10">
        Introducing Clarity.Lecture
      </h2>
      <div className="grid md:grid-cols-3 gap-6 px-8 mb-14">
        <FeatureCard
          title="Understand"
          description="Transform complex educational content into easily digestible formats. Perfect for students, educators, and lifelong learners seeking deeper understanding."
          icon={<svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>}
          isLarge={true}
        />
        <FeatureCard
          title="Chat"
          description="Ask specific questions about your content and receive contextual explanations. Get clarification on challenging concepts tailored exactly to your documents and learning materials."
          icon={<svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>}
          isLarge={true}
        />
        <FeatureCard
          title="Create"
          description="Automatically generate summaries, flashcards, quizzes, and study guides from your documents. Turn passive reading into active learning with interactive exercises."
          icon={<svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>}
          isLarge={true}
        />
      </div>

      {/* Spacer between Clarity.Lecture and Text Transformer */}
      <div className="py-20"></div>

      {/* Features Grid */}
      <h2 className="text-4xl font-medium text-gray-900 dark:text-white text-center mb-10">
        Powerful Text Transformation
      </h2>
      <div className="grid md:grid-cols-2 gap-6 px-6">
        <FeatureCard
          title="Simplify"
          description="Make complex text easier to understand with multiple levels of simplification, perfect for explaining difficult concepts."
          icon={<svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>}
        />
        <FeatureCard
          title="Sophisticate"
          description="Elevate your writing with more refined language and structure, ideal for academic or professional contexts."
          icon={<svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>}
        />
        <FeatureCard
          title="Casualise"
          description="Make your text more approachable and conversational, perfect for social media or informal communication."
          icon={<svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
          </svg>}
        />
        <FeatureCard
          title="Formalise"
          description="Add professionalism and polish to your writing, suitable for business communications and formal documents."
          icon={<svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>}
        />
      </div>

      {/* Google Login Info */}
      <div className="container mx-auto px-6 py-7 max-w-4xl text-center">
        <p className="text-gray-600 dark:text-gray-300 text-sm">
          Clarity supports both Google login and email/password authentication for a seamless experience.
        </p>
      </div>
    </div>
  );
};

export default TryClarity; 