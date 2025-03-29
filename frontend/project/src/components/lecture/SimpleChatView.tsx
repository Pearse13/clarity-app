import React, { useState, useEffect, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import SimpleChatInput from './SimpleChatInput';
import { API_ENDPOINTS } from '../../config/api';
import LoadingSpinner from '../LoadingSpinner';
import ThreeDotsLoader from '../ThreeDotsLoader';
import { Copy, Check, BookOpen, X, Loader2, Bot, PoundSterling } from 'lucide-react';
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
  const [apiStatus, setApiStatus] = useState<'untested' | 'available' | 'unavailable'>('untested');
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isGeneratingStudyGuide, setIsGeneratingStudyGuide] = useState(false);
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  const [costInfo, setCostInfo] = useState<CostInfo>({
    current_cost: 0,
    remaining_budget: 0.80,
    reset_time: new Date().toISOString()
  });
  
  // Handle clicks on the chat area to clear text selection
  const handleChatAreaClick = () => {
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
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
    setIsGeneratingText(true);

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
          setIsGeneratingText(false);
          
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
    }, 40);

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
    
    // Create new abort controller for this request
    const controller = new AbortController();
    
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

      // Make the API request with the abort signal
      const response = await fetch(API_ENDPOINTS.chat.send, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token.access_token}`
        },
        body: JSON.stringify({
          message,
          selectedText: associatedSelectedText,
          documentText
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          throw new Error(errorData.detail || 'Rate limit exceeded. Please try again later.');
        }
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data: ChatApiResponse = await response.json();
      
      // Update cost info
      setCostInfo(data.cost_info);
      
      // Add assistant's response to chat history
      setMessages(prev => [
        ...prev,
        { 
          type: 'assistant',
          content: data.message
        }
      ]);

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

  // Handle study guide generation
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

      // The actual prompt sent to the API (not shown in chat)
      const studyGuidePrompt = `System: You are Clarity, an AI assistant focused on helping users understand their lecture materials. Always use British English spelling and conventions silently (e.g., "colour", "organisation"). Format any titles in responses using "## " for main titles and "### " for subtitles. Never mention these formatting rules to users.

For study guide generation, follow this exact format:
- Start with "## Overview" section containing a brief overview
- Include "## Quiz Questions" section with questions formatted as:
  ### Question 1
  [Question text]
  <click to reveal answer>
  Answer: [Answer]
  Explanation: [Explanation]
- Include "## Essay Questions" section with questions as "### Essay Question [number]"
- Include "## Key Terms" section with terms as "### [Term]" followed by definition
- End with "## Summary Points" using bullet points (•)
- Maintain proper spacing between sections
- Always put answers after "<click to reveal answer>" tag

User: Please create a comprehensive study guide for this document. Include an overview, quiz questions, essay questions, key terms, and summary points.`;

      const response = await fetch(API_ENDPOINTS.chat.send, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: studyGuidePrompt,
          document_text: documentText,
          selected_text: null
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate study guide');
      }

      const data: ChatApiResponse = await response.json();
      
      // Add the response with animation in the normal chat flow
      setMessages(prev => {
        const newMessages = [
          ...prev,
          {
            type: 'assistant' as const,
            content: '',
            isAnimating: true,
            animatedContent: ''
          }
        ];
        // Start animation immediately
        animateTextWordByWord(data.message, newMessages.length - 1);
        return newMessages;
      });

    } catch (err) {
      console.error('Study guide generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate study guide');
      
      // Add error message to chat
      setMessages(prev => [
        ...prev,
        { 
          type: 'assistant' as const, 
          content: `Error: Failed to generate study guide. Please try again.`
        }
      ]);
    } finally {
      setIsGeneratingStudyGuide(false);
    }
  };

  // Add a function to handle click events for revealing answers
  const handleAnswerReveal = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    const button = target.closest('.answer-reveal-button');
    if (button) {
      const answerContent = button.nextElementSibling as HTMLElement;
      if (answerContent) {
        answerContent.classList.toggle('hidden');
        // Toggle the arrow rotation
        const arrow = button.querySelector('.arrow') as HTMLElement;
        if (arrow) {
          arrow.style.transform = answerContent.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(90deg)';
        }
      }
    }
  };

  // Update the formatMessageContent function
  const formatMessageContent = (content: string): string => {
    let isInAnswerSection = false;
    
    return content
      .split('\n')
      .map(line => {
        // Handle study guide answer reveals
        if (line.trim() === '<click to reveal answer>') {
          isInAnswerSection = true;
          return `
            <button class="answer-reveal-button text-blue-600 hover:text-blue-800 my-2 flex items-center gap-2 cursor-pointer">
              <span class="arrow transition-transform duration-200" style="display: inline-block;">▶</span>
              Click to reveal answer
            </button>
            <div class="hidden ml-4 my-2">`;
        }
        
        // Handle main titles
        if (line.startsWith('## ')) {
          isInAnswerSection = false;
          return `<div class="text-xl font-bold my-4 border-b pb-2">${line.substring(3)}</div>`;
        }
        
        // Handle subtitles
        if (line.startsWith('### ')) {
          isInAnswerSection = false;
          return `<div class="text-lg font-bold my-3">${line.substring(4)}</div>`;
        }

        // Handle bullet points
        if (line.startsWith('• ')) {
          return `<div class="ml-4 my-1">• ${line.substring(2)}</div>`;
        }

        // Close answer section if we hit an empty line after "Explanation:"
        if (line.trim() === '' && isInAnswerSection && content.split('\n')[content.split('\n').indexOf(line) - 1]?.includes('Explanation:')) {
          isInAnswerSection = false;
          return '</div>';
        }

        // Format answer and explanation lines
        if (isInAnswerSection) {
          if (line.startsWith('Answer:') || line.startsWith('Explanation:')) {
            return `<div class="font-medium">${line}</div>`;
          }
        }

        return line;
      })
      .join('\n');
  };

  // Add some CSS to handle the arrow rotation
  const styles = `
    <style>
      .answer-reveal-button[aria-expanded="true"] span {
        transform: rotate(90deg);
      }
      .answer-reveal-button:hover span {
        transform: translateX(2px);
      }
      .answer-reveal-button[aria-expanded="true"]:hover span {
        transform: rotate(90deg);
      }
    </style>
  `;

  // Add function to stop text generation
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
          lastMessage.content = lastMessage.animatedContent + ' [Generation stopped]';
          lastMessage.animatedContent = undefined;
        }
        return newMessages;
      });
      
      setIsGeneratingText(false);
    }
  };

  return (
    <div 
      className="h-full flex flex-col bg-white rounded-lg shadow-sm p-6"
      onMouseDown={handleChatAreaClick}
      onClick={handleAnswerReveal}
    >
      <div dangerouslySetInnerHTML={{ __html: styles }} />
      
      {/* Header with API status and cost info */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
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
        <div className="flex items-center gap-4">
          {/* Cost info */}
          <div className="flex items-center gap-2 text-sm">
            <PoundSterling className="w-4 h-4 text-blue-600" />
            <span className="text-gray-600">
              £{costInfo.current_cost.toFixed(2)} / £0.80
            </span>
            <div className="h-4 w-[100px] bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${(costInfo.current_cost / 0.80) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">
              Resets in {new Date(costInfo.reset_time).toLocaleTimeString()}
            </span>
          </div>
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
      
      {/* Chat message history */}
      <div className="flex-1 mb-4 overflow-y-auto">
        {messages.length > 0 ? (
          <div className="space-y-6">
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${message.type === 'user' ? 'text-right pr-4' : 'text-left'}`}>
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
                          dangerouslySetInnerHTML={{ __html: formatMessageContent(message.animatedContent) }}
                        />
                      ) : (
                        <div 
                          className="text-gray-800 whitespace-pre-line text-[15px] animate-fade-in"
                          dangerouslySetInnerHTML={{ __html: formatMessageContent(message.content) }}
                        />
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
            {/* Show 3-dot loader when AI is thinking */}
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
            <p className="text-center">
              Hi! I'm Clarity. Ask me questions about your lecture document!
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

      {/* Buttons */}
      <div className="flex flex-col gap-2 mt-2">
        {documentText && (
          <div className="flex gap-2">
            <button
              onClick={handleGenerateStudyGuide}
              disabled={isGeneratingStudyGuide || !documentText}
              className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors flex-1 ${
                isGeneratingStudyGuide || !documentText
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
              }`}
            >
              {isGeneratingStudyGuide ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <BookOpen className="w-4 h-4" />
                  Generate Study Guide
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimpleChatView; 