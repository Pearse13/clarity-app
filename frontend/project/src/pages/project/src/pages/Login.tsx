import React, { useState } from 'react';
import { Brain, Lock, Mail, ArrowLeft } from 'lucide-react';

interface LoginProps {
  onBack: () => void;
}

function Login({ onBack }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle login logic here
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-6">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8">
        {/* Left Column - Branding */}
        <div className="flex flex-col justify-center space-y-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors w-fit"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
            Back to home
          </button>
          <div className="flex items-center gap-3">
            <Brain className="w-8 h-8 text-blue-600" strokeWidth={1.5} />
            <h1 className="text-[2.5rem] font-medium tracking-tight text-gray-900">
              Clarity
            </h1>
          </div>
          <p className="text-xl text-gray-600 tracking-tight">
            Enhance your learning journey with AI-powered study tools designed to help you achieve clarity in your understanding.
          </p>
        </div>

        {/* Right Column - Login Form */}
        <div className="flex items-center">
          <div className="glass-card w-full p-8 rounded-2xl shadow-sm space-y-8">
            <div className="space-y-2">
              <h2 className="text-2xl font-medium text-gray-900">Welcome back</h2>
              <p className="text-gray-600">Sign in to continue your learning journey</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm text-gray-600">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" strokeWidth={1.5} />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field pl-10"
                    placeholder="Enter your email"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm text-gray-600">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" strokeWidth={1.5} />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field pl-10"
                    placeholder="Enter your password"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded border-gray-200/50" />
                  <span className="text-sm text-gray-600">Remember me</span>
                </label>
                <a href="#" className="text-sm text-blue-600 hover:text-blue-700">
                  Forgot password?
                </a>
              </div>

              <button type="submit" className="primary-button">
                Sign in
              </button>

              <button type="button" className="secondary-button">
                Sign up
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;