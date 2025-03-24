import React, { useState, useRef } from 'react';
import { Send, AlertCircle } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';

interface SimpleChatInputProps {
  currentText: string | null;
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

const SimpleChatInput: React.FC<SimpleChatInputProps> = ({
  currentText,
  onSendMessage,
  isLoading = false,
  error = null,
}) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleSend = () => {
    if (!inputValue.trim() || isLoading) return;
    
    onSendMessage(inputValue.trim());
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col">
      {/* Input Area */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about your document..."
          className="w-full p-3 pr-12 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={!inputValue.trim() || isLoading}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
          aria-label="Send message"
        >
          {isLoading ? <LoadingSpinner size="sm" /> : <Send className="w-5 h-5" />}
        </button>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="mt-2 text-sm text-red-500 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}
    </div>
  );
};

export default SimpleChatInput; 