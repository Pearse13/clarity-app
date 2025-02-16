import React, { useState } from 'react';
import { Brain, Sparkles, BookOpen, Zap, MessageCircle } from 'lucide-react';

interface LandingProps {
  onTryClarity: () => void;
}

function Landing({ onTryClarity }: LandingProps) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle message submission
    console.log('Message submitted:', message);
    setMessage('');
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      {/* Header */}
      <header className="w-full max-w-6xl mx-auto px-6 py-6 flex items-center">
        <div className="flex items-center gap-3">
          <Brain className="w-8 h-8 text-blue-600" strokeWidth={1.5} />
          <h1 className="text-[2.5rem] font-medium tracking-tight text-gray-900">
            Clarity
          </h1>
        </div>
      </header>

      {/* Hero Section */}
      <main className="w-full max-w-6xl mx-auto px-6 pt-20 pb-32">
        <div className="text-center space-y-8 max-w-3xl mx-auto">
          <h2 className="text-5xl font-medium tracking-tight text-gray-900">
            AI-Powered Learning
          </h2>
          <p className="text-xl text-gray-600">
            Experience the future of learning with Clarity's advanced AI technology. Transform complex topics into clear, understandable concepts.
          </p>
          <button
            onClick={onTryClarity}
            className="primary-button max-w-xs mx-auto text-lg"
          >
            Try Clarity API
          </button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-32">
          <div className="glass-card p-6 rounded-2xl space-y-4">
            <Sparkles className="w-8 h-8 text-blue-600" strokeWidth={1.5} />
            <h3 className="text-xl font-medium text-gray-900">
              AI-Powered Understanding
            </h3>
            <p className="text-gray-600">
              Advanced AI algorithms break down complex topics into easily digestible concepts.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl space-y-4">
            <BookOpen className="w-8 h-8 text-blue-600" strokeWidth={1.5} />
            <h3 className="text-xl font-medium text-gray-900">
              Personalized Learning
            </h3>
            <p className="text-gray-600">
              Adaptive learning paths that adjust to your understanding and pace.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl space-y-4">
            <Zap className="w-8 h-8 text-blue-600" strokeWidth={1.5} />
            <h3 className="text-xl font-medium text-gray-900">
              Instant Insights
            </h3>
            <p className="text-gray-600">
              Get immediate explanations and examples for any concept you're studying.
            </p>
          </div>
        </div>

        {/* Contact Form */}
        <div className="mt-32 max-w-xl mx-auto">
          <form onSubmit={handleSubmit} className="glass-card p-6 rounded-2xl space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <MessageCircle className="w-5 h-5 text-blue-600" strokeWidth={1.5} />
              <h3 className="text-lg font-medium text-gray-900">Contact Us</h3>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Questions? Suggestions? Let us know how we can help..."
              className="w-full min-h-[120px] px-4 py-3 bg-gray-50/50 border border-gray-200/50 rounded-xl 
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       transition-colors duration-200 resize-y"
            />
            <button 
              type="submit" 
              className="primary-button"
            >
              Send Message
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

export default Landing;