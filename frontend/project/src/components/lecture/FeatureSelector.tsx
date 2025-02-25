import React from 'react';
import { Brain, MessageSquare, Wand2 } from 'lucide-react';

interface FeatureSelectorProps {
  selectedOption: 'understand' | 'chat' | 'create';
  onOptionSelect: (option: 'understand' | 'chat' | 'create') => void;
}

const FeatureSelector: React.FC<FeatureSelectorProps> = ({ selectedOption, onOptionSelect }) => {
  const features = [
    {
      id: 'understand',
      label: 'Understand',
      icon: Brain,
      description: 'Upload your lecture materials to get a deep understanding of the content. Our AI will analyze and break down complex topics into easily digestible formats.'
    },
    {
      id: 'chat',
      label: 'Chat',
      icon: MessageSquare,
      description: 'Have an interactive discussion about your lecture materials. Ask questions, get clarifications, and explore topics in depth with our AI assistant.'
    },
    {
      id: 'create',
      label: 'Create',
      icon: Wand2,
      description: 'Generate study materials based on your lecture content. Create summaries, flashcards, quizzes, and more to enhance your learning experience.'
    }
  ] as const;

  return (
    <div className="w-full lg:w-1/2 bg-white rounded-xl shadow-sm p-8">
      <div className="max-w-md mx-auto">
        {/* Options Selector */}
        <div className="flex gap-4 mb-8">
          {features.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onOptionSelect(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-colors ${
                selectedOption === id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-50/80 backdrop-blur-xl text-gray-600 hover:bg-gray-50/90'
              }`}
            >
              <Icon className="w-4 h-4 stroke-[1.5]" />
              {label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="bg-gray-50/80 backdrop-blur-xl rounded-2xl p-6">
          {features.map(({ id, description }) => (
            selectedOption === id && (
              <p key={id} className="text-[15px] text-gray-600">
                {description}
              </p>
            )
          ))}
        </div>
      </div>
    </div>
  );
};

export default FeatureSelector; 