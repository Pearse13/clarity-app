import React, { useState, useEffect, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import SimpleChatInput from './SimpleChatInput';
import { API_ENDPOINTS } from '../../config/api';
import LoadingSpinner from '../LoadingSpinner';
import { Copy, Check, BookOpen } from 'lucide-react';
import '../../styles/animations.css';

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
  isAnimating?: boolean;
  animatedContent?: string;
  isStudyGuide?: boolean;
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
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isGeneratingStudyGuide, setIsGeneratingStudyGuide] = useState(false);
  
  // Handle clicks on the chat area to clear text selection
  const handleAreaClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // Check if clicking inside the chat input area or on any input-related elements
    const isInputInteraction = 
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'BUTTON' ||
      target.closest('.chat-input-area') !== null;

    // Only clear selection if clicking outside input areas
    if (currentText && onClearSelection && !isInputInteraction) {
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
        },
        detailedResponse: true
      });
      
      console.log("Testing API connection to:", API_ENDPOINTS.chat.health);
      
      const response = await fetch(API_ENDPOINTS.chat.health, { 
        headers: {
          'Authorization': `Bearer ${token.access_token}`
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
    } catch (err: unknown) {
      console.error("API connection test error:", err);
      setApiStatus('unavailable');
      // Handle refresh token error
      if (err instanceof Error && err.message?.includes('Missing Refresh Token')) {
        setError('Please log in again to continue using the chat feature.');
      }
    } finally {
      setIsApiTesting(false);
    }
  };

  // Function to animate text word by word
  const animateTextWordByWord = (text: string, messageIndex: number) => {
    if (!text) return;

    // Clear any existing animation
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current);
    }

    // Split by newlines first, then words
    const lines = text.split('\n');
    let currentLineIndex = 0;
    let currentWordIndex = 0;
    let currentLine = lines[0];
    let words = currentLine ? currentLine.split(' ') : [];

    // Create new interval for word-by-word animation
    const intervalId = setInterval(() => {
      setMessages(prevMessages => {
        const newMessages = [...prevMessages];
        if (!newMessages[messageIndex]) return prevMessages;

        let displayedContent = '';
        
        // Handle completed lines
        for (let i = 0; i < currentLineIndex; i++) {
          displayedContent += lines[i] + '\n';
        }

        // Handle current line
        if (currentLine) {
          const displayedWords = words.slice(0, currentWordIndex + 1);
          const displayedWordsHtml = displayedWords
            .map((word, index) => {
              const safeWord = word
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
              return index === currentWordIndex 
                ? `<span class="animated-word">${safeWord}</span>` 
                : safeWord;
            })
            .join(' ');
          displayedContent += displayedWordsHtml;
        }

        newMessages[messageIndex] = {
          ...newMessages[messageIndex],
          isAnimating: true,
          content: '', // Keep content empty while animating
          animatedContent: displayedContent
        };
        return newMessages;
      });

      // Move to next word or line
      currentWordIndex++;
      if (currentWordIndex >= words.length) {
        currentLineIndex++;
        if (currentLineIndex < lines.length) {
          currentLine = lines[currentLineIndex];
          words = currentLine ? currentLine.split(' ') : [];
          currentWordIndex = 0;
        } else {
          // Animation complete
          clearInterval(intervalId);
          animationIntervalRef.current = null;
          
          setMessages(prevMessages => {
            const newMessages = [...prevMessages];
            if (newMessages[messageIndex]) {
              newMessages[messageIndex] = {
                ...newMessages[messageIndex],
                isAnimating: false,
                content: text,
                animatedContent: undefined
              };
            }
            return newMessages;
          });
        }
      }
    }, 40); // Speed of word appearance

    animationIntervalRef.current = intervalId;
  };

  // Cleanup animation interval on unmount
  useEffect(() => {
    return () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
      }
    };
  }, []);

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return;
    
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
            },
            detailedResponse: true
        });
        
        // Get surrounding context if we have selected text and document text
        let contextBefore = '';
        let contextAfter = '';
        
        if (associatedSelectedText && documentText) {
            const selectionStart = documentText.indexOf(associatedSelectedText);
            if (selectionStart !== -1) {
                // Get 150 words before and after the selection
                const beforeText = documentText.slice(0, selectionStart);
                const afterText = documentText.slice(selectionStart + associatedSelectedText.length);
                
                const beforeWords = beforeText.split(/\s+/).slice(-150).join(' ');
                const afterWords = afterText.split(/\s+/).slice(0, 150).join(' ');
                
                contextBefore = beforeWords;
                contextAfter = afterWords;
            }
        }
        
        // Prepare the request payload
        const payload = {
            message,
            document_text: documentText || undefined,
            selected_text: associatedSelectedText || undefined,
            context_before: contextBefore || undefined,
            context_after: contextAfter || undefined
        };
        
        console.log("Sending chat request with payload:", {
            message: payload.message,
            hasDocumentText: !!payload.document_text,
            hasSelectedText: !!payload.selected_text,
            hasContextBefore: !!payload.context_before,
            hasContextAfter: !!payload.context_after
        });

        if (apiStatus === 'available') {
            try {
                console.log("Sending chat request to:", API_ENDPOINTS.chat.send);
                
                // API is available, make the actual request
                const response = await fetch(API_ENDPOINTS.chat.send, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token.access_token}`,
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
                
                console.log("Chat API response status:", response.status);
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    console.error("Error response:", errorData);
                    
                    // Handle token limit exceeded error
                    if (response.status === 429 && errorData.detail?.toLowerCase().includes('token limit exceeded')) {
                        setMessages(prev => [
                            ...prev,
                            {
                                type: 'assistant' as const,
                                content: "I apologize, but I've reached the token limit for this document. This limit helps keep costs reasonable. You can:\n\n" +
                                        "1. Ask more focused questions about specific parts of the document\n" +
                                        "2. Select smaller portions of text to analyze\n" +
                                        "3. Start a new chat with a different document"
                            }
                        ]);
                        setError("Token limit exceeded for this document");
                        return;
                    }
                    
                    throw new Error(errorData.detail || `Chat request failed with status ${response.status}`);
                }
                
                const data: ChatApiResponse = await response.json();
                console.log("Chat API response data:", data);
                
                // Add assistant response with empty content
                setMessages(prev => {
                    const newMessages = [
                        ...prev,
                        { 
                            type: 'assistant' as const, 
                            content: '', // Start with empty content
                            isAnimating: true,
                            animatedContent: '' // Start with empty animated content
                        }
                    ];
                    // Start animation immediately
                    animateTextWordByWord(data.message, newMessages.length - 1);
                    return newMessages;
                });
                
                setModelUsed(data.model);
                setTokenUsage(data.token_usage);
            } catch (apiError: any) {
                console.error("API error:", apiError);
                
                // Add error message to chat
                setMessages(prev => [
                    ...prev,
                    { 
                        type: 'assistant' as const, 
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
                { type: 'assistant' as const, content: fallbackMessage }
            ]);
            
            setModelUsed("Unavailable - using fallback");
        }
        
    } catch (err: any) {
        console.error('Chat error:', err);
        setError(err.message || 'An error occurred');
        
        // Handle refresh token error
        if (err.message?.includes('Missing Refresh Token')) {
            setMessages(prev => [
                ...prev,
                { 
                    type: 'assistant' as const, 
                    content: 'Your session has expired. Please log in again to continue using the chat feature.' 
                }
            ]);
        } else {
            // Add error message to chat
            setMessages(prev => [
                ...prev,
                { 
                    type: 'assistant' as const, 
                    content: `Authentication error: ${err.message || "Failed to authenticate"}\n\nPlease try logging in again.` 
                }
            ]);
        }
    } finally {
        setIsLoading(false);
    }
};

  // Scroll to bottom whenever messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Function to count lines in text
  const countLines = (text: string): number => {
    if (!text) return 0;
    // Split by newlines and filter out empty lines
    return text.split('\n').filter(line => line.trim().length > 0).length;
  };

  // Reset copied state after 2 seconds
  useEffect(() => {
    if (copiedMessageIndex !== null) {
      const timer = setTimeout(() => {
        setCopiedMessageIndex(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [copiedMessageIndex]);

  const handleCopyMessage = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageIndex(index);
    } catch (err) {
      console.error('Failed to copy text:', err);
      setError('Failed to copy text to clipboard');
    }
  };

  // Add study guide generation handler
  const handleGenerateStudyGuide = async () => {
    if (!documentText || isGeneratingStudyGuide) return;
    
    setIsGeneratingStudyGuide(true);
    setError(null);

    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: 'openid profile email offline_access'
        }
      });

      // Add the study guide request message
      const studyGuidePrompt = `Please analyze the provided document and create a comprehensive study guide that includes:

1. A brief overview of the main topics and concepts
2. 5-10 multiple choice quiz questions with answers and explanations
3. 3-5 essay questions that test deeper understanding
4. A glossary of key terms and their definitions
5. Important points to remember

Please format the study guide with clear sections and use markdown for better readability.`;
      
      setMessages(prev => [...prev, { type: 'user', content: studyGuidePrompt }]);

      const response = await fetch(API_ENDPOINTS.chat.send, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: studyGuidePrompt,
          document_text: documentText,
          selected_text: null,
          is_study_guide: true
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate study guide');
      }

      const data: ChatApiResponse = await response.json();
      
      // Add the response as a new message
      setMessages(prev => [...prev, {
        type: 'assistant',
        content: data.message,
        isStudyGuide: true
      }]);

      // Update model and token usage info
      setModelUsed(data.model);
      setTokenUsage(data.token_usage);

    } catch (err) {
      console.error('Study guide generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate study guide');
    } finally {
      setIsGeneratingStudyGuide(false);
    }
  };

  return (
    <div 
      className="h-full flex flex-col bg-white rounded-lg shadow-sm p-6"
      onMouseDown={handleAreaClick}
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
      
      {/* Model and Token Usage Info */}
      {(modelUsed || tokenUsage) && (
        <div className="mb-4 text-xs text-gray-500">
          {modelUsed && <div>Model: {modelUsed}</div>}
          {tokenUsage && (
            <div>
              Tokens: {tokenUsage.total_tokens} 
              (Input: {tokenUsage.prompt_tokens}, Output: {tokenUsage.completion_tokens})
            </div>
          )}
        </div>
      )}
      
      {/* Selected Text Indicator */}
      {currentText && (
        <div className="mb-4 flex items-center justify-between text-xs text-blue-600">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-blue-500"></span>
            <span>{countLines(currentText)} {countLines(currentText) === 1 ? 'line' : 'lines'} selected from document</span>
          </div>
          {onClearSelection && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onClearSelection();
              }}
              className="text-blue-500 hover:text-blue-700"
            >
              Clear
            </button>
          )}
        </div>
      )}
      
      {/* Chat message history */}
      <div className="flex-1 mb-4 overflow-y-auto">
        {messages.length > 0 ? (
          <div className="space-y-6">
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${message.type === 'user' ? 'text-right' : 'text-left'}`}>
                  {message.type === 'user' && message.selectedText && (
                    <div className="mb-1 text-[11px] text-blue-500 flex items-center gap-1">
                      <span className="inline-flex h-1 w-1 rounded-full bg-blue-400"></span>
                      <span>Using {countLines(message.selectedText)} {countLines(message.selectedText) === 1 ? 'line' : 'lines'}</span>
                    </div>
                  )}
                  <div className="text-xs text-gray-500 mb-1">
                    {message.type === 'user' ? 'You' : 'Assistant'}
                  </div>
                  {message.type === 'assistant' ? (
                    <div className="relative">
                      {message.isAnimating && message.animatedContent ? (
                        <div 
                          className="text-gray-800 whitespace-pre-line text-[15px]"
                          dangerouslySetInnerHTML={{ __html: message.animatedContent }}
                        />
                      ) : (
                        <div className="text-gray-800 whitespace-pre-line text-[15px] animate-fade-in">
                          {message.content}
                        </div>
                      )}
                      {/* Copy button for AI responses */}
                      {message.type === 'assistant' && !message.isAnimating && message.content && (
                        <div className="mt-2 flex justify-end animate-fade-in">
                          <button
                            onClick={() => handleCopyMessage(message.content, index)}
                            className="p-1 text-gray-500 hover:text-gray-700 rounded transition-colors"
                            title="Copy response"
                          >
                            {copiedMessageIndex === index ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-gray-800 whitespace-pre-line text-[15px]">
                      {message.content}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
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
      
      {/* Input area */}
      <div className="mt-auto chat-input-area">
        <SimpleChatInput
          currentText={currentText}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          error={error}
        />
      </div>

      {/* Chat header with study guide button */}
      <div className="flex justify-between items-center px-4 py-2 border-t border-gray-200">
        <div></div>
        {documentText && (
          <button
            onClick={handleGenerateStudyGuide}
            disabled={isGeneratingStudyGuide || !documentText}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              isGeneratingStudyGuide || !documentText
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            {isGeneratingStudyGuide ? 'Generating...' : 'Generate Study Guide'}
          </button>
        )}
      </div>
    </div>
  );
};

export default SimpleChatView; 