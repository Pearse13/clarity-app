import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import SimpleChatInput from './SimpleChatInput';
import { API_ENDPOINTS } from '../../config/api';
import LoadingSpinner from '../LoadingSpinner';

interface SimpleChatViewProps {
  currentText: string | null;
  documentText: string | null;
  selectedText: string | null;
  onClearSelection?: () => void;
}

// Define interfaces for token usage and API response
interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface ChatApiResponse {
  message: string;
  model: string;
  token_usage: TokenUsage;
}

interface ChatMessage {
  type: 'user' | 'assistant';
  content: string;
  selectedText?: string | null;
}

const SimpleChatView: React.FC<SimpleChatViewProps> = ({
  currentText,
  documentText,
  selectedText,
  onClearSelection
}) => {
  const { getAccessTokenSilently } = useAuth0();
  const [isLoading, setIsLoading] = useState(false);
  const [isApiTesting, setIsApiTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null);
  const [apiStatus, setApiStatus] = useState<'untested' | 'available' | 'unavailable'>('untested');
  
  // Handle clicks on the chat area to clear text selection
  const handleAreaClick = () => {
    if (currentText && onClearSelection) {
      onClearSelection();
    }
  };

  // Test the API connection when component mounts
  useEffect(() => {
    testApiConnection();
  }, []);

  // Function to test API connection
  const testApiConnection = async () => {
    setIsApiTesting(true);
    setError(null);
    
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: 'openid profile email offline_access'
        }
      });
      
      console.log("Testing API connection to:", API_ENDPOINTS.chat.health);
      
      const response = await fetch(API_ENDPOINTS.chat.health, { 
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log("API health check response:", response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log("API health data:", data);
        
        if (data.status === "healthy") {
          setApiStatus('available');
          console.log("Chat API is available");
        } else {
          setApiStatus('unavailable');
          console.log("Chat API is unavailable:", data);
        }
      } else {
        setApiStatus('unavailable');
        console.log("Chat API health check failed:", response.status);
      }
    } catch (err) {
      console.error("API connection test error:", err);
      setApiStatus('unavailable');
    } finally {
      setIsApiTesting(false);
    }
  };

  const handleSendMessage = async (message: string) => {
    setIsLoading(true);
    setError(null);
    
    // Save the current selected text to associate with this message
    const associatedSelectedText = selectedText;
    
    // Add user message to chat history immediately
    setMessages(prev => [
      ...prev, 
      { 
        type: 'user', 
        content: message,
        selectedText: associatedSelectedText
      }
    ]);
    
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: 'openid profile email offline_access'
        }
      });
      
      // Prepare the request payload
      const payload = {
        message,
        document_text: documentText || undefined,
        selected_text: associatedSelectedText || undefined
      };
      
      console.log("Sending chat request with payload:", {
        message: payload.message,
        hasDocumentText: !!payload.document_text,
        hasSelectedText: !!payload.selected_text
      });

      if (apiStatus === 'available') {
        try {
          console.log("Sending chat request to:", API_ENDPOINTS.chat.send);
          
          // API is available, make the actual request
          const response = await fetch(API_ENDPOINTS.chat.send, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
          });
          
          console.log("Chat API response status:", response.status);
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("Error response:", errorData);
            throw new Error(errorData.detail || `Chat request failed with status ${response.status}`);
          }
          
          const data: ChatApiResponse = await response.json();
          console.log("Chat API response data:", data);
          
          // Add assistant response to chat history
          setMessages(prev => [
            ...prev,
            { type: 'assistant', content: data.message }
          ]);
          
          setModelUsed(data.model);
          setTokenUsage(data.token_usage);
        } catch (apiError: any) {
          console.error("API error:", apiError);
          
          // Add error message to chat
          setMessages(prev => [
            ...prev,
            { 
              type: 'assistant', 
              content: `Error: ${apiError.message || "Failed to get response from API"}\n\nPlease try again or check if the API is configured correctly.` 
            }
          ]);
          
          setError(apiError.message || "Failed to get response from API");
        }
      } else {
        // API is not available, use fallback
        console.log("API not available, using fallback response");
        
        // Fallback response
        const fallbackMessage = "This is a placeholder response. The Claude API is not available at this time. Please check if your Anthropic API key is configured correctly in your Railway environment variables.";
        
        // Add fallback response to chat history
        setMessages(prev => [
          ...prev,
          { type: 'assistant', content: fallbackMessage }
        ]);
        
        setModelUsed("Unavailable - using fallback");
      }
      
    } catch (err: any) {
      console.error('Chat error:', err);
      setError(err.message || 'An error occurred');
      
      // Add error message to chat
      setMessages(prev => [
        ...prev,
        { 
          type: 'assistant', 
          content: `Authentication error: ${err.message || "Failed to authenticate"}\n\nPlease try logging in again.` 
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="h-full flex flex-col bg-white rounded-lg shadow-sm p-6"
      onClick={handleAreaClick}
    >
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-medium text-gray-900">
          Lecture Assistant
        </h2>
        <div className="flex items-center gap-2">
          <span className={`inline-flex h-2 w-2 rounded-full ${
            apiStatus === 'available' ? 'bg-green-500' : 
            apiStatus === 'unavailable' ? 'bg-red-500' : 'bg-gray-400'
          }`}></span>
          <span className="text-sm text-gray-500">
            {apiStatus === 'available' ? 'API Connected' : 
             apiStatus === 'unavailable' ? 'API Unavailable' : 'Checking API...'}
          </span>
          <button
            onClick={testApiConnection}
            disabled={isApiTesting}
            className="text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-400 ml-2"
          >
            {isApiTesting ? <LoadingSpinner size="sm" /> : 'Test'}
          </button>
        </div>
      </div>
      
      {/* Selected Text Display with dismiss button */}
      {currentText && (
        <div className="mb-4 bg-blue-50 p-4 rounded-lg border border-blue-100 relative">
          <div className="text-sm font-medium text-blue-700 mb-2 flex justify-between">
            <span>Selected Text:</span>
            {onClearSelection && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onClearSelection();
                }}
                className="text-blue-500 hover:text-blue-700 text-sm"
              >
                Clear
              </button>
            )}
          </div>
          <p className="text-gray-800 whitespace-pre-line selection:bg-blue-200">
            {currentText}
          </p>
        </div>
      )}
      
      {/* Chat message history */}
      <div className="flex-1 mb-4 overflow-y-auto">
        {messages.length > 0 ? (
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div key={index} className={`${message.type === 'user' ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-200'} rounded-lg p-4 border selection:bg-blue-100`}>
                {/* If it's a user message with selected text, show it */}
                {message.type === 'user' && message.selectedText && (
                  <div className="mb-3 p-2 bg-blue-100 rounded border border-blue-200 text-sm">
                    <div className="font-medium text-blue-800 mb-1 text-xs">Selected text:</div>
                    <p className="text-gray-800">{message.selectedText}</p>
                  </div>
                )}
                <div className="text-sm font-medium text-gray-500 mb-2">
                  {message.type === 'user' ? 'You:' : 'Assistant:'}
                </div>
                <p className="text-gray-800 whitespace-pre-line">
                  {message.content}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-500">
            <p className="text-center">
              Ask questions about your lecture document!
            </p>
            {apiStatus === 'unavailable' && (
              <p className="text-center text-amber-500 mt-2 max-w-md text-sm">
                Note: API connection unavailable. Make sure you have configured your Anthropic API key in Railway.
              </p>
            )}
          </div>
        )}
      </div>
      
      {/* Model info */}
      {modelUsed && (
        <div className="flex justify-between mb-4 text-xs text-gray-500">
          <div>Using model: {modelUsed}</div>
          {tokenUsage && (
            <div>
              Tokens: {tokenUsage.total_tokens} (Prompt: {tokenUsage.prompt_tokens}, Completion: {tokenUsage.completion_tokens})
            </div>
          )}
        </div>
      )}
      
      {/* Input area */}
      <div className="mt-auto">
        <SimpleChatInput
          currentText={currentText}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          error={error}
        />
      </div>
    </div>
  );
};

export default SimpleChatView; 