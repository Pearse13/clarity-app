import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { motion } from 'framer-motion';

const FeatureCard: React.FC<{ title: string; description: string; icon: JSX.Element; isLarge?: boolean }> = ({ 
  title, 
  description,
  icon,
  isLarge = false
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: false, amount: 0.3 }}
    transition={{ duration: 0.6, ease: "easeOut" }}
    className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-card p-5 rounded-xl shadow-sm"
  >
    <div className="text-blue-600 dark:text-blue-400 mb-3">
      {icon}
    </div>
    <h3 className={`${isLarge ? 'text-xl' : 'text-lg'} font-medium text-gray-900 dark:text-white mb-2`}>{title}</h3>
    <p className="text-gray-600 dark:text-gray-300">{description}</p>
  </motion.div>
);

const TryClarity: React.FC = () => {
  const { loginWithRedirect } = useAuth0();

  const handleLogin = async () => {
    try {
      await loginWithRedirect({
        appState: { returnTo: '/lecture' },
        authorizationParams: {
          prompt: 'login',
          response_type: 'code',
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: 'openid profile email offline_access'
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-gray-900 flex flex-col">
      {/* Hero Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="flex flex-col items-center justify-center px-6 pt-14 pb-16"
      >
        <div className="flex items-center gap-2 mb-6">
          <h1 className="text-[5.1rem] font-medium tracking-tight text-gray-900 dark:text-white">
            Clarity API
          </h1>
        </div>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="text-xl text-black dark:text-white text-center max-w-2xl mb-6 text-[1.93em] font-semibold"
        >
          Understand it First
        </motion.p>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="text-xl text-gray-600 dark:text-gray-300 text-center max-w-2xl mb-20"
        >
          Your personal AI Study Assistant - Powered by Clarity API
        </motion.p>
        <motion.button 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7, duration: 0.8 }}
          onClick={handleLogin}
          className="px-16 py-8 bg-blue-600 text-white text-3xl rounded-xl hover:bg-blue-700 transition-colors duration-200 font-medium shadow-lg"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Try Clarity
        </motion.button>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.8 }}
          className="mt-4 text-gray-600 dark:text-gray-400 text-center"
        >
          Sign in with Google or email to continue
        </motion.p>
      </motion.div>

      {/* What We Do Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.3 }}
        transition={{ duration: 0.6 }}
        className="text-center px-6 py-16"
      >
        <h2 className="text-4xl font-medium text-gray-900 dark:text-white mb-6">What We Do</h2>
        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
          We empower learners and educators with AI-powered tools that transform complex content into clear, actionable knowledge.
          Our suite of features helps you understand, interact with, and create from your educational materials.
        </p>
      </motion.div>

      {/* Clarity Lectures Section */}
      <motion.h2 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.3 }}
        transition={{ duration: 0.6 }}
        className="text-4xl font-medium text-gray-900 dark:text-white text-center mb-10"
      >
        Introducing Clarity Lectures
      </motion.h2>
      <div className="grid md:grid-cols-3 gap-6 px-8 mb-14">
        <FeatureCard
          title="Understand"
          description="Transform complex educational content into clear, concise insights with our AI-powered tool—perfect for students, educators, and lifelong learners!"
          icon={<svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>}
          isLarge={true}
        />
        <FeatureCard
          title="Chat"
          description="Upload your notes, textbooks, or documents and ask anything—get clear, accurate answers and explanations tailored to your content!"
          icon={<svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>}
          isLarge={true}
        />
        <FeatureCard
          title="Create"
          description="Generate flashcards, quizzes, summaries and study guides from your documents. Turn passive reading into active learning with interactive exercises."
          icon={<svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>}
          isLarge={true}
        />
      </div>

      {/* Text Transformation Section */}
      <motion.h2 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.3 }}
        transition={{ duration: 0.6 }}
        className="text-4xl font-medium text-gray-900 dark:text-white text-center mb-10 pt-20"
      >
        Clarity Text Transformer
      </motion.h2>
      <div className="grid md:grid-cols-3 gap-6 px-6 mb-20">
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
      </div>

      {/* Authentication Info */}
      <motion.div 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: false, amount: 0.3 }}
        transition={{ duration: 0.6 }}
        className="container mx-auto px-6 py-7 max-w-4xl text-center"
      >
        <p className="text-gray-600 dark:text-gray-300">
          Clarity supports both Google login and email/password authentication for a seamless experience.
        </p>
      </motion.div>
    </div>
  );
};

export default TryClarity; 