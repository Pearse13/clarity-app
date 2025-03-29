import React, { useState, useRef, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Send, Bot, User, AlertCircle, Copy, Check } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { API_URL } from '../../config/api';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

interface ChatOutputProps {
  currentText: string | null;
  documentText: string | null;
  selectedText: string | null;
}

const ChatOutput: React.FC<ChatOutputProps> = ({ 
  currentText, 
  documentText,
  selectedText 
}) => {
  const { getAccessTokenSilently, loginWithRedirect } = useAuth0();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Reset copied state after 2 seconds
  useEffect(() => {
    if (copiedMessageId) {
      const timer = setTimeout(() => {
        setCopiedMessageId(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [copiedMessageId]);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // When currentText changes (text selection), update input field with it
  useEffect(() => {
    if (currentText && currentText.trim() !== '') {
      setInputValue(prev => {
        // Only replace if input is empty or just whitespace
        if (!prev.trim()) {
          return currentText;
        }
        return prev;
      });
      // Focus the input field
      inputRef.current?.focus();
    }
  }, [currentText]);

  const handleError = (err: Error) => {
    if (err.message?.includes('Missing Refresh Token')) {
      setError('Your session has expired. Please log in again.');
      // Redirect to login after a short delay
      setTimeout(() => {
        loginWithRedirect({
          appState: { returnTo: window.location.pathname }
        });
      }, 2000);
      return;
    }
    
    // Try to parse error message if it's JSON
    try {
      const errorData = JSON.parse(err.message);
      if (Array.isArray(errorData)) {
        // Format validation errors nicely
        setError(`API validation error: ${errorData.map(e => e.msg || e).join(", ")}`);
        return;
      }
    } catch (e) {
      // Not JSON, use as is
    }
    
    setError(`Unable to process request: ${err.message}`);
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text: inputValue.trim(),
      sender: 'user',
      timestamp: new Date()
    };

    // Add user message to chat
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setError(null);

    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: 'openid profile email offline_access'
        }
      });

      console.log("Sending chat request...");
      
      // Prepare the request payload
      const payload = {
        message: userMessage.text,
        document_text: documentText || undefined,
        selected_text: selectedText || undefined
      };
      
      console.log("Request payload:", {
        message: payload.message,
        hasDocumentText: !!payload.document_text,
        hasSelectedText: !!payload.selected_text
      });
      
      // Send request to chat endpoint
      const response = await fetch(`${API_URL}/api/lecture/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      console.log("Response received:", response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Chat request failed');
      }
      
      const data = await response.json();
      console.log("Response data:", data);
      
      // Add AI response to chat
      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        text: data.message,
        sender: 'ai',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiMessage]);
      setModelUsed(data.model);
      
    } catch (err: any) {
      console.error('Chat error:', err);
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  
  const clearChat = () => {
    setMessages([]);
    setError(null);
    setModelUsed(null);
  };

  const handleCopyMessage = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
    } catch (err) {
      console.error('Failed to copy text:', err);
      setError('Failed to copy text to clipboard');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border-2 border-blue-300 overflow-hidden">
      {/* Chat Header */}
      <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          <h2 className="text-lg font-medium">Clarity AI Assistant</h2>
        </div>
        
        {messages.length > 0 && (
          <button 
            onClick={clearChat}
            className="text-sm text-blue-200 hover:text-white"
          >
            Clear Chat
          </button>
        )}
      </div>
      
      {/* Chat Messages */}
      <div className="flex-grow p-4 overflow-y-auto bg-gray-50">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500">
            <Bot className="w-12 h-12 mb-3 text-blue-500" />
            <p className="text-center">
              Ask questions about your lecture document. <br />
              I'll help you understand the content.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div 
                key={message.id} 
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-[80%] p-3 rounded-lg ${
                    message.sender === 'user' 
                      ? 'bg-blue-600 text-white rounded-br-none' 
                      : 'bg-gray-200 text-gray-800 rounded-bl-none'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {message.sender === 'ai' ? (
                      <Bot className="w-4 h-4" />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                    <span className="text-xs">
                      {message.sender === 'user' ? 'You' : 'Claude'}
                    </span>
                  </div>
                  <p className="whitespace-pre-line">{message.text}</p>
                  {message.sender === 'ai' && (
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={() => handleCopyMessage(message.text, message.id)}
                        className="p-1 text-gray-500 hover:text-gray-700 rounded transition-colors"
                        title="Copy response"
                      >
                        {copiedMessageId === message.id ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 p-3 text-red-700 border-t border-red-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}
      
      {/* Input Area */}
      <div className="p-4 border-t border-gray-200">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your document..."
            className="w-full p-3 pr-12 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={3}
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="absolute right-3 bottom-3 p-2 text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
            aria-label="Send message"
          >
            {isLoading ? <LoadingSpinner size="sm" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
        
        {selectedText && (
          <div className="mt-2 text-xs text-gray-500">
            You have selected text from the document. Your question will reference this selection.
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatOutput; 