import React, { useState, useEffect, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import SimpleChatInput from './SimpleChatInput';
import { API_ENDPOINTS } from '../../config/api';
import LoadingSpinner from '../LoadingSpinner';
import ThreeDotsLoader from '../ThreeDotsLoader';
import { Copy, Check, BookOpen, X, Loader2, Bot, FileText } from 'lucide-react';
import { useAuthRefresh } from '../../hooks/useAuthRefresh';
import '../../styles/animations.css';

interface SimpleChatViewProps {
  currentText: string | null;
  documentText: string | null;
  selectedText: string | null;
  onClearSelection?: () => void;
  isGeneratingStudyGuide?: boolean;
  isGeneratingBriefing?: boolean;
  onGenerateStudyGuide?: () => Promise<void>;
  onGenerateBriefing?: () => Promise<void>;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

// Define interfaces for token usage and API response
interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface CostInfo {
  current_cost: number;
  remaining_budget: number;
  reset_time: string;
}

interface ChatApiResponse {
  message: string;
  model: string;
  token_usage: TokenUsage;
  cost_info: CostInfo;
}

interface ChatMessage {
  type: 'user' | 'assistant';
  content: string;
  selectedText?: string | null;
  isAnimating?: boolean;
  animatedContent?: string;
  isStudyGuide?: boolean;
  words?: string[];
  currentWordIndex?: number;
}

const SimpleChatView: React.FC<SimpleChatViewProps> = ({
  currentText,
  documentText,
  selectedText,
  onClearSelection,
  isGeneratingStudyGuide = false,
  isGeneratingBriefing = false,
  onGenerateStudyGuide,
  onGenerateBriefing,
  messages,
  setMessages
}): JSX.Element => {
  const { getAccessTokenSilently } = useAuth0();
  const { handleTokenRefresh } = useAuthRefresh();
  
  // State hooks
  const [isLoading, setIsLoading] = useState(false);
  const [isApiTesting, setIsApiTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<'untested' | 'available' | 'unavailable'>('untested');
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  
  // Ref hooks
  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const documentTextRef = useRef<string | null>(null);
  
  // Effect hooks
  useEffect(() => {
    testApiConnection();
  }, []);

  // Handle clicks on the chat area to clear text selection
  const handleChatAreaClick = () => {
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
  };

  // Test the API connection when component mounts
  const testApiConnection = async () => {
    if (isApiTesting) return; // Prevent duplicate calls
    setIsApiTesting(true);
    setError(null);
    
    try {
      console.log("API Configuration:", {
        apiUrl: API_ENDPOINTS.chat.health,
        isDevelopment: import.meta.env.MODE === 'development',
        productionUrl: import.meta.env.VITE_PRODUCTION_API_URL
      });
      
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: 'openid profile email offline_access'
        },
        detailedResponse: true
      });
      
      console.log("Testing API connection to:", API_ENDPOINTS.chat.health);
      
      let response = await fetch(API_ENDPOINTS.chat.health, { 
        headers: {
          'Authorization': `Bearer ${token.access_token}`
        }
      });
      
      // If unauthorized, try token refresh and retry request
      if (response.status === 401) {
        const refreshSuccess = await handleTokenRefresh();
        if (refreshSuccess) {
          // Retry the request with new token
          const newToken = await getAccessTokenSilently({
            authorizationParams: {
              audience: import.meta.env.VITE_AUTH0_AUDIENCE,
              scope: 'openid profile email offline_access'
            },
            detailedResponse: true
          });
          
          response = await fetch(API_ENDPOINTS.chat.health, { 
            headers: {
              'Authorization': `Bearer ${newToken.access_token}`
            }
          });
        }
      }

      if (!response.ok) {
        setApiStatus('unavailable');
        console.log("Chat API health check failed:", response.status);
        return;
      }
      
      const data = await response.json();
      console.log("API health data:", data);
      
      if (data.status === "healthy") {
        setApiStatus('available');
        console.log("Chat API is available");
      } else {
        setApiStatus('unavailable');
        console.log("Chat API is unavailable:", data);
      }
    } catch (err: unknown) {
      console.error("API connection test error:", err);
      setApiStatus('unavailable');
      if (err instanceof Error && err.message?.includes('Missing Refresh Token')) {
        await handleTokenRefresh();
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
    
    const words = text.split(' ');
    let currentWordIndex = 0;
    
    // Create new interval for word-by-word animation
    const intervalId = setInterval(() => {
      if (currentWordIndex < words.length) {
        // Update the message with the current words
        setMessages(prev => {
          const newMessages = [...prev];
          const message = newMessages[messageIndex];
          if (message) {
            message.isAnimating = true;
            message.words = words.slice(0, currentWordIndex + 1);
            message.currentWordIndex = currentWordIndex;
          }
          return newMessages;
        });
        
        currentWordIndex++;
      } else {
        // Animation complete
        clearInterval(intervalId);
        animationIntervalRef.current = null;
        
        // Update the message to show final content
        setMessages(prev => {
          const newMessages = [...prev];
          const message = newMessages[messageIndex];
          if (message) {
            message.isAnimating = false;
            message.content = text;
            message.words = undefined;
            message.currentWordIndex = undefined;
          }
          return newMessages;
        });
      }
    }, 40); // Speed of word appearance (milliseconds)
    
    // Store interval ID in ref
    animationIntervalRef.current = intervalId;
  };

  // Function to stop text generation
  const stopTextGeneration = () => {
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current);
      animationIntervalRef.current = null;
      
      // Update the last message to show it was interrupted
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && lastMessage.isAnimating) {
          lastMessage.isAnimating = false;
          lastMessage.content = lastMessage.words?.join(' ') + ' [Generation stopped]';
          lastMessage.words = undefined;
          lastMessage.currentWordIndex = undefined;
        }
        return newMessages;
      });
      
      setIsGeneratingText(false);
    }
  };

  // Modify handleSendMessage to use word-by-word animation
  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return;
    
    setIsLoading(true);
    setError(null);
    setIsGeneratingText(true);
    
    // Create new abort controller for this request
    const controller = new AbortController();
    
    // Save the current selected text to associate with this message
    const associatedSelectedText = selectedText;
    
    // Store the original user message
    const userMessage = message.trim();
    
    // Add user message to chat history immediately
    setMessages(prev => [
      ...prev, 
      { 
        type: 'user', 
        content: userMessage,
        selectedText: associatedSelectedText
      }
    ]);
    
    try {
      let token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: 'openid profile email offline_access'
        },
        detailedResponse: true
      });

      // Make the API request with the abort signal
      let response = await fetch(API_ENDPOINTS.chat.send, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token.access_token}`
        },
        body: JSON.stringify({
          message: userMessage,
          selected_text: associatedSelectedText,
          document_text: documentText
        }),
        signal: controller.signal
      });

      // If unauthorized, try token refresh and retry request
      if (response.status === 401) {
        const refreshSuccess = await handleTokenRefresh();
        if (refreshSuccess) {
          // Get new token after refresh
          token = await getAccessTokenSilently({
            authorizationParams: {
              audience: import.meta.env.VITE_AUTH0_AUDIENCE,
              scope: 'openid profile email offline_access'
            },
            detailedResponse: true
          });

          // Retry the request with new token
          response = await fetch(API_ENDPOINTS.chat.send, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token.access_token}`
            },
            body: JSON.stringify({
              message: userMessage,
              selected_text: associatedSelectedText,
              document_text: documentText
            }),
            signal: controller.signal
          });
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          throw new Error(errorData.detail || 'Rate limit exceeded. Please try again later.');
        }
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data: ChatApiResponse = await response.json();
      
      // Add assistant's response with animation
      const messageIndex = messages.length;
      setMessages(prev => [
        ...prev,
        { 
          type: 'assistant',
          content: '',
          isAnimating: true
        }
      ]);
      
      // Start the word-by-word animation
      animateTextWordByWord(data.message, messageIndex);

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Request was aborted');
        return;
      }
      
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      console.error('Chat error:', errorMessage);
      
      setMessages(prev => [
        ...prev,
        { 
          type: 'assistant',
          content: `Error: ${errorMessage}\n\nPlease try again or check if the API is configured correctly.`
        }
      ]);
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setIsGeneratingText(false);
    }
  };

  // Modify the scroll behavior to always scroll to bottom
  const scrollToBottom = () => {
    if (!messagesEndRef.current) return;
    messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  };

  // Update useEffect to always scroll on messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Remove the old scroll during text generation effect since we're always scrolling
  useEffect(() => {
    if (!isGeneratingText) {
      scrollToBottom();
    }
  }, [isGeneratingText]);

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

  // Add effect to handle documentText changes and cleanup
  useEffect(() => {
    // Handle cleanup when documentText becomes null
    if (documentText === null) {
      console.log('SimpleChatView: documentText is null, cleaning up state');
      setMessages([]);
      setError(null);
      setIsGeneratingText(false);
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
        animationIntervalRef.current = null;
      }
    }

    // Only log if documentText changes
    const prevDocumentText = documentTextRef.current;
    if (prevDocumentText !== documentText) {
      console.log('SimpleChatView: documentText update:', {
        hasDocumentText: !!documentText,
        textLength: documentText?.length || 0,
        sample: documentText ? documentText.substring(0, 100) + '...' : 'null',
        isGeneratingStudyGuide,
        isGeneratingBriefing,
        isLoading,
        shouldShowButtons: !!documentText && !isGeneratingStudyGuide && !isGeneratingBriefing && !isLoading,
        timestamp: new Date().toISOString(),
        renderingLocation: 'footer section below chat input'
      });
      documentTextRef.current = documentText;
    }
  }, [documentText, isGeneratingStudyGuide, isGeneratingBriefing, isLoading]);

  // Handle study guide generation
  const handleGenerateStudyGuide = async () => {
    console.log('SimpleChatView: Attempting to generate study guide:', {
      hasDocumentText: !!documentText,
      isGeneratingStudyGuide,
      hasCallback: !!onGenerateStudyGuide
    });
    
    if (!documentText || isGeneratingStudyGuide) return;
    
    // Add a loading message first
    const loadingMessageIndex = messages.length;
    setMessages(prev => [
      ...prev,
      {
        type: 'assistant',
        content: '',
        isAnimating: true,
        animatedContent: 'Generating your study guide...'
      }
    ]);

    if (onGenerateStudyGuide) {
      await onGenerateStudyGuide();
    }

    // Remove the loading message after generation
    setMessages(prev => prev.filter((_, index) => index !== loadingMessageIndex));
  };

  // Simplify the handleAnswerReveal function to work independently
  const handleAnswerReveal = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    const button = target.closest('.answer-reveal-button');
    if (button) {
      const answerContent = button.nextElementSibling as HTMLElement;
      if (answerContent) {
        const isExpanded = button.getAttribute('aria-expanded') === 'true';
        button.setAttribute('aria-expanded', (!isExpanded).toString());
        answerContent.classList.toggle('hidden');
      }
    }
  };

  // Simplify the formatMessageContent function to use simpler HTML
  const formatMessageContent = (content: string): string => {
    return content
      .split('\n')
      .map(line => {
        // Format quiz question numbers (e.g., "Q1.", "Q2.")
        if (line.trim().match(/^Q\d+\./)) {
          return `
            ${line.trim() === 'Q1.' ? '' : '<div class="border-t border-gray-200 my-6"></div>'}
            <div class="text-lg font-semibold my-4 text-gray-800">${line}</div>`;
        }

        // Format quiz questions and answers
        if (line.trim() === '<click to reveal answer>') {
          return `
            <button class="answer-reveal-button text-blue-600 hover:text-blue-800 my-2 flex items-center gap-2">
              <span class="transition-transform duration-200">►</span>
              Click to reveal answer
            </button>
            <div class="hidden answer-content my-2 text-base text-gray-700">`;
        }
        
        if (line.trim() === '</answer>') {
          return '</div>';
        }

        // Format document title (Briefing Document or Study Guide)
        if (line.startsWith('Briefing Document:') || line.startsWith('Study Guide:')) {
          return `<div class="text-2xl font-bold my-6 text-gray-900">${line}</div>`;
        }
        
        // Format main section headers (Roman numerals or numbered sections)
        if (line.match(/^[IVX]+\.|^\d+\./) && line.includes(':')) {
          return `<div class="text-xl font-bold my-5 text-gray-800">${line}</div>`;
        }

        // Format sub-headers (bullet points)
        if (line.trim().startsWith('•') || (line.includes(':') && !line.match(/^[IVX]+\.|^\d+\./))) {
          return `<div class="text-lg font-semibold my-4 text-gray-700">${line}</div>`;
        }

        // Format list items (dashes)
        if (line.trim().startsWith('-')) {
          return `<div class="ml-4 my-3 text-base text-gray-600">${line}</div>`;
        }

        // Format quoted text
        if (line.trim().startsWith('"')) {
          return `<div class="ml-4 my-3 text-base italic text-gray-600">${line}</div>`;
        }

        // Format bold terms
        if (line.includes('**')) {
          return `<div class="my-3 text-base text-gray-700">${line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</div>`;
        }
        
        // Default paragraph formatting
        return `<div class="my-3 text-base text-gray-700">${line}</div>`;
      })
      .join('\n');
  };

  // Add styles for quiz formatting and animations
  const styles = `
    <style>
      .animated-word {
        color: #2563eb;
        opacity: 0;
        animation: fadeIn 0.5s forwards;
      }
      
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(5px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .answer-reveal-button span {
        display: inline-block;
        transition: transform 0.2s;
      }

      .answer-reveal-button[aria-expanded="true"] span {
        transform: rotate(90deg);
      }

      .answer-content {
        margin-left: 0 !important;
      }

      @keyframes pulse {
        0% {
          box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
        }
        70% {
          box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
        }
      }

      .pulse-button {
        animation: pulse 2s infinite;
      }
    </style>
  `;

  // Handle briefing generation
  const handleGenerateBriefing = async () => {
    if (!documentText || isGeneratingBriefing) return;
    if (onGenerateBriefing) {
      await onGenerateBriefing();
    }
  };

  // Cleanup animation interval on unmount
  useEffect(() => {
    return () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
      }
    };
  }, []);

  return (
    <div 
      className="h-full flex flex-col bg-white rounded-lg shadow-sm p-4 md:p-6 relative chat-view overflow-hidden"
      onMouseDown={handleChatAreaClick}
      onClick={handleAnswerReveal}
    >
      <div dangerouslySetInnerHTML={{ __html: styles }} />
      
      {/* Header with API status and cost info */}
      <div className="flex-none flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4 mb-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            <h2 className="text-lg font-medium">Clarity AI Assistant</h2>
          </div>
          {isGeneratingText && (
            <button
              onClick={stopTextGeneration}
              className="flex items-center gap-2 px-2 py-1 text-sm text-red-600 hover:text-red-800 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
            >
              <X className="w-4 h-4" />
              Stop generating
            </button>
          )}
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          {/* API status */}
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
      </div>
      
      {/* Selected Text Indicator */}
      <div className="flex-none">
        {currentText ? (
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
        ) : (
          <div className="mb-4 text-xs text-gray-500">
            No text selected. Select text or the area around text from the document to transform it
          </div>
        )}
      </div>
      
      {/* Chat message history - increased height */}
      <div className="flex-1 overflow-y-auto mb-4 md:mb-6 min-h-0">
        {messages.length > 0 ? (
          <div className="space-y-6 md:space-y-8">
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] md:max-w-[85%] ${message.type === 'user' ? 'text-right pr-4' : 'text-left'}`}>
                  {message.type === 'user' && message.selectedText && (
                    <div className="mb-1 text-sm text-blue-500 flex items-center gap-1">
                      <span className="inline-flex h-1 w-1 rounded-full bg-blue-400"></span>
                      <span>Using {countLines(message.selectedText)} {countLines(message.selectedText) === 1 ? 'line' : 'lines'}</span>
                    </div>
                  )}
                  <div className="text-sm text-gray-500 mb-2">
                    {message.type === 'user' ? 'You' : 'Assistant'}
                  </div>
                  {message.type === 'assistant' && message.isAnimating ? (
                    <div className="text-gray-800">
                      {message.words?.map((word, wordIndex) => (
                        <span
                          key={wordIndex}
                          className={`inline-block ${
                            wordIndex === message.currentWordIndex ? 'animated-word' : ''
                          }`}
                        >
                          {word}{' '}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-gray-800 whitespace-pre-line text-sm md:text-base leading-relaxed">
                      {message.type === 'assistant' ? (
                        <div dangerouslySetInnerHTML={{ __html: formatMessageContent(message.content) }} />
                      ) : (
                        message.content
                      )}
                    </div>
                  )}
                  {message.type === 'assistant' && message.content && (
                    <div className="mt-2 flex justify-end">
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
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] text-left">
                  <div className="text-xs text-gray-500 mb-1">Assistant</div>
                  <div className="flex items-center gap-2 text-gray-800">
                    <ThreeDotsLoader />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-500">
            <p className="text-center mb-8">
              Hi! I'm Clarity. Ask me questions about your lecture document!
            </p>
            {/* Centered Study Guide Button */}
            {documentText && (
              <button
                onClick={handleGenerateStudyGuide}
                disabled={isGeneratingStudyGuide || isLoading}
                className={`py-3 px-8 ${
                  isGeneratingStudyGuide || isLoading
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                    : 'bg-white text-blue-600 hover:bg-blue-50 border border-blue-200'
                } rounded-lg flex items-center gap-2 transition-colors shadow-sm`}
              >
                {isGeneratingStudyGuide ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <BookOpen className="w-4 h-4" />
                )}
                {isGeneratingStudyGuide ? 'Generating Study Guide...' : 'Generate Study Guide'}
              </button>
            )}
            {apiStatus === 'unavailable' && (
              <p className="text-center text-amber-500 mt-6 max-w-md text-sm">
                Note: API connection unavailable. Make sure you have configured your Anthropic API key in Railway.
              </p>
            )}
          </div>
        )}
      </div>
      
      {/* Chat input and buttons area - moved closer to bottom */}
      <div className="flex-none mt-auto">
        <div className="chat-input-area mb-4">
          <SimpleChatInput
            currentText={currentText}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            error={error}
          />
        </div>

        {/* Footer with Generate buttons */}
        {documentText && (
          <div className="mt-2 border-t pt-4 flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleGenerateStudyGuide}
              disabled={isGeneratingStudyGuide}
              className={`flex-1 py-3 px-4 ${
                isGeneratingStudyGuide 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } rounded-lg flex items-center justify-center gap-2 transition-colors`}
            >
              {isGeneratingStudyGuide ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <BookOpen className="w-4 h-4" />
              )}
              {isGeneratingStudyGuide ? 'Generating Study Guide...' : 'Generate Study Guide'}
            </button>

            <button
              onClick={handleGenerateBriefing}
              disabled={isGeneratingBriefing}
              className={`flex-1 py-3 px-4 ${
                isGeneratingBriefing 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } rounded-lg flex items-center justify-center gap-2 transition-colors`}
            >
              {isGeneratingBriefing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              {isGeneratingBriefing ? 'Generating Briefing...' : 'Generate Briefing'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimpleChatView; 