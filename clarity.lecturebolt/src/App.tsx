import React, { useState } from 'react';
import { Upload, Brain, MessageSquare, Wand2 } from 'lucide-react';

function App() {
  const [selectedOption, setSelectedOption] = useState<'understand' | 'chat' | 'create'>('understand');

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex">
      {/* Left Side - File Upload */}
      <div className="w-1/2 flex items-center justify-center border-r border-gray-200/50">
        <label 
          htmlFor="file-upload"
          className="flex flex-col items-center gap-4 p-6 rounded-2xl bg-white/80 backdrop-blur-xl shadow-sm hover:bg-white/90 transition-colors cursor-pointer"
        >
          <Upload className="w-8 h-8 text-blue-600 stroke-[1.5]" />
          <span className="text-[15px] text-gray-900 font-medium tracking-tight">
            Upload Files
          </span>
          <input 
            id="file-upload" 
            type="file" 
            className="hidden" 
            multiple 
          />
        </label>
      </div>

      {/* Right Side - Options */}
      <div className="w-1/2 p-8">
        <div className="max-w-md mx-auto">
          {/* Options Selector */}
          <div className="flex gap-4 mb-8">
            <button
              onClick={() => setSelectedOption('understand')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-colors ${
                selectedOption === 'understand'
                ? 'bg-blue-600 text-white'
                : 'bg-white/80 backdrop-blur-xl text-gray-600 hover:bg-white/90'
              }`}
            >
              <Brain className="w-4 h-4 stroke-[1.5]" />
              Understand
            </button>
            <button
              onClick={() => setSelectedOption('chat')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-colors ${
                selectedOption === 'chat'
                ? 'bg-blue-600 text-white'
                : 'bg-white/80 backdrop-blur-xl text-gray-600 hover:bg-white/90'
              }`}
            >
              <MessageSquare className="w-4 h-4 stroke-[1.5]" />
              Chat
            </button>
            <button
              onClick={() => setSelectedOption('create')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-colors ${
                selectedOption === 'create'
                ? 'bg-blue-600 text-white'
                : 'bg-white/80 backdrop-blur-xl text-gray-600 hover:bg-white/90'
              }`}
            >
              <Wand2 className="w-4 h-4 stroke-[1.5]" />
              Create
            </button>
          </div>

          {/* Content Area */}
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-sm">
            {selectedOption === 'understand' && (
              <p className="text-[15px] text-gray-600">
                Upload your lecture materials to get a deep understanding of the content.
              </p>
            )}
            {selectedOption === 'chat' && (
              <p className="text-[15px] text-gray-600">
                Have an interactive discussion about your lecture materials.
              </p>
            )}
            {selectedOption === 'create' && (
              <p className="text-[15px] text-gray-600">
                Generate new content based on your lecture materials.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;