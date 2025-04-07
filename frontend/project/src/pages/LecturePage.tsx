import React, { useState, useEffect, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Brain, MessageSquare, Wand2, ChevronDown, Upload, Copy, Check } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { FileProvider } from '../contexts/FileContext';
import { PresentationViewer } from '../components/presentation/PresentationViewer';
import { TransformationType } from '../types/transform';
import SimpleChatView from '../components/lecture/SimpleChatView';
import { useSidebar } from '../contexts/SidebarContext';
import { isTransformResponse, isApiError } from '../types/api';
import { API_ENDPOINTS } from '../config/api';

type ActiveTab = 'understand' | 'chat' | 'teach';

const TRANSFORMATION_DETAILS = [
  {
    id: 'simplify',
    label: 'Simplify',
    description: 'Makes text clearer and more accessible'
  },
  {
    id: 'casualise',
    label: 'Casualise',
    description: 'Makes text super chill and easy-going'
  },
  {
    id: 'sophisticate',
    label: 'Sophisticate',
    description: 'Enhances vocabulary and structure'
  }
];

const LEVEL_DETAILS = [
  {
    id: 1,
    label: 'Level 1 - Age 7-8',
    description: 'Basic vocabulary, simple sentences'
  },
  {
    id: 2,
    label: 'Level 2 - Age 9-10',
    description: 'Expanded vocabulary, compound sentences'
  },
  {
    id: 3,
    label: 'Level 3 - Age 11-12',
    description: 'Complex sentences, intermediate concepts'
  },
  {
    id: 4,
    label: 'Level 4 - Age 13-14',
    description: 'Advanced vocabulary, abstract concepts'
  },
  {
    id: 5,
    label: 'Level 5 - Age 15+',
    description: 'Sophisticated language, complex topics'
  }
];

const LevelSelect = ({ value, onChange }: { value: number; onChange: (value: number) => void }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex justify-between items-center"
      >
        <span>{LEVEL_DETAILS[value - 1].label}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
            {LEVEL_DETAILS.map((lvl) => (
              <button
                key={lvl.id}
                onClick={() => {
                  onChange(lvl.id);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-left hover:bg-gray-50 ${
                  value === lvl.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="font-medium">{lvl.label}</div>
                <div className="text-sm text-gray-500 mt-0.5">{lvl.description}</div>
              </button>
            ))}
          </div>
        </>
      )}
      
      <div className="mt-1 text-sm text-gray-500">
        {LEVEL_DETAILS[value - 1].description}
      </div>
    </div>
  );
};

const TransformationTypeSelect = ({ value, onChange }: { value: TransformationType; onChange: (value: TransformationType) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedType = TRANSFORMATION_DETAILS.find(type => type.id === value) || TRANSFORMATION_DETAILS[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex justify-between items-center"
      >
        <span>{selectedType.label}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
            {TRANSFORMATION_DETAILS.map((type) => (
              <button
                key={type.id}
                onClick={() => {
                  onChange(type.id as TransformationType);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-left hover:bg-gray-50 ${
                  value === type.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="font-medium">{type.label}</div>
                <div className="text-sm text-gray-500 mt-0.5">{type.description}</div>
              </button>
            ))}
          </div>
        </>
      )}
      
      <div className="mt-1 text-sm text-gray-500">
        {selectedType.description}
      </div>
    </div>
  );
};

// Define a type for the presentation viewer ref
type PresentationViewerRefType = {
  resetPresentation: () => void;
};

// Custom styles for text transformation effects
const styles = {
  transformHighlight: {
    animation: 'highlightFadeIn 0.5s ease-in-out'
  }
};

// Function to safely escape HTML special characters
const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

interface ChatMessage {
  type: 'user' | 'assistant';
  content: string;
  selectedText?: string | null;
  isAnimating?: boolean;
  animatedContent?: string;
  isStudyGuide?: boolean;
}

const LecturePage: React.FC = () => {
  const { getAccessTokenSilently } = useAuth0();
  const { isOpen, toggle } = useSidebar();
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [level, setLevel] = useState<number>(1);
  const [transformationType, setTransformationType] = useState<TransformationType>('simplify');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [characterCount, setCharacterCount] = useState<number>(0);
  const [isOverLimit, setIsOverLimit] = useState<boolean>(false);
  const [currentText, setCurrentText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [documentText, setDocumentText] = useState<string | null>(null);
  const [isTransformed, setIsTransformed] = useState<boolean>(false);
  const [animatedText, setAnimatedText] = useState<string>('');
  const [isGeneratingStudyGuide, setIsGeneratingStudyGuide] = useState(false);
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const presentationViewerRef = useRef<PresentationViewerRefType>(null);
  // @ts-ignore - Header visibility feature in development
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);
  
  // Add scroll handler for header visibility
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setIsHeaderVisible(false);
      } else {
        setIsHeaderVisible(true);
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Reference for the animation interval
  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Create ref to avoid closure issues in event handlers
  const documentTextRef = useRef<string | null>(null);
  
  // Update ref when state changes
  useEffect(() => {
    documentTextRef.current = documentText;
  }, [documentText]);

  // Add logging when document text is set
  useEffect(() => {
    // Only log if the value has actually changed
    if (documentTextRef.current !== documentText) {
      console.log('LecturePage: documentText state changed:', {
        hasDocumentText: !!documentText,
        textLength: documentText?.length || 0,
        sample: documentText ? documentText.substring(0, 100) + '...' : 'null',
        timestamp: new Date().toISOString()
      });
      documentTextRef.current = documentText;
    }
  }, [documentText]);

  // Function to animate text word by word with error handling
  const animateTextWordByWord = (text: string | undefined) => {
    // Input validation
    if (!text) {
      console.error('Received empty or undefined text for animation');
      setError('Unable to animate empty text');
      return;
    }

    // Clear any existing animation
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current);
    }
    
    setAnimatedText('');
    const words = text.split(' ');
    let currentWordIndex = 0;
    
    // Create new interval for word-by-word animation
    const intervalId = setInterval(() => {
      try {
        if (currentWordIndex < words.length) {
          // We'll now build the HTML with spans for each word
          const displayedWords = words.slice(0, currentWordIndex + 1);
          
          // Create a string with spans for animated words
          const displayedWordsHtml = displayedWords
            .map((word, index) => {
              // Sanitize the word to prevent XSS
              const safeWord = escapeHtml(word);
              // Add the 'animated-word' class only to the latest word
              const isLatestWord = index === currentWordIndex;
              return isLatestWord 
                ? `<span class="animated-word">${safeWord}</span>` 
                : safeWord;
            })
            .join(' ');
            
            // Use the full string with HTML markup for the animation
            setAnimatedText(displayedWordsHtml);
            currentWordIndex++;
          } else {
            clearInterval(intervalId);
            animationIntervalRef.current = null;
            
            // Once animation is complete, update the currentText
            setTimeout(() => {
              setCurrentText(text);
              // Clear the animated text
              setAnimatedText('');
            }, 300);
          }
        } catch (err) {
          console.error('Animation error:', err);
          clearInterval(intervalId);
          animationIntervalRef.current = null;
          setError('Failed to animate text');
          // Fallback to displaying the text without animation
          setCurrentText(text);
        }
      }, 40); // Speed of word appearance (milliseconds)
      
      // Store interval ID in ref
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

  const handleTransform = (text: string, extractedText?: string) => {
    console.log('LecturePage: handleTransform called:', {
      hasText: !!text,
      textLength: text?.length || 0,
      hasExtractedText: !!extractedText,
      extractedTextLength: extractedText?.length || 0
    });
    
    // Clear any ongoing animation when new text is selected
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current);
      animationIntervalRef.current = null;
    }
    
    if (text && text.trim()) {
      console.log('LecturePage: Text selection received, updating state');
      console.log('LecturePage: Previous text was:', currentText);
      
      // Immediately display the text
      setCurrentText(text);
      setAnimatedText(''); // Clear animated text
      setCharacterCount(text.length);
      setIsOverLimit(text.length > 1000);
      setError(null);
      
      // Update document text if provided
      if (extractedText) {
        console.log('LecturePage: Document text provided, length:', extractedText.length);
        setDocumentText(extractedText);
      }
      
      // Log after state update
      setTimeout(() => {
        console.log('LecturePage: State updated, currentText is now:', text);
      }, 0);
    } else {
      console.log('LecturePage: Empty text selection received, ignoring');
    }
  };

  // Simple function to handle text selection
  const handleTextSelection = () => {
    // Don't update if we're loading or already showing transformed text
    if (isLoading || isTransformed) return;

    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    
    if (selectedText && selectedText.length > 0) {
      // Check if selection is from the document viewer
      const selectionNode = selection?.anchorNode?.parentElement;
      const isFromDocument = selectionNode?.closest('.react-pdf__Page') || 
                           selectionNode?.closest('.document-viewer-area');
      
      if (isFromDocument) {
        setCurrentText(selectedText);
        setCharacterCount(selectedText.length);
        setIsOverLimit(selectedText.length > 1000);
        setError(null);
      }
    }
  };

  // Add event listener for text selection
  useEffect(() => {
    document.addEventListener('mouseup', handleTextSelection);
    return () => document.removeEventListener('mouseup', handleTextSelection);
  }, [isLoading, isTransformed]);

  // Simple function to handle clicks outside the text area
  const handleClickOutside = (e: MouseEvent) => {
    // Don't deselect if clicking in chat input or messages
    const target = e.target as HTMLElement;
    if (
      target.closest('.chat-input') || 
      target.closest('.chat-messages') ||
      target.closest('.chat-container')
    ) {
      return;
    }
    
    // Only deselect if clicking outside the document viewer
    const documentViewer = document.querySelector('.document-viewer');
    if (documentViewer && !documentViewer.contains(target as Node)) {
      window.getSelection()?.removeAllRanges();
    }
  };

  // Add event listener for clearing selection
  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [currentText, isLoading, isTransformed]);

  // Add a utility function to limit context to first 150 words
  const getLimitedDocumentContext = (fullText: string | null): string | null => {
    if (!fullText) return null;
    
    // Split by words and take first 150
    // This optimizes API token usage while still providing sufficient context
    // for the AI to understand the document's topic and terminology
    const words = fullText.split(/\s+/);
    const limitedWords = words.slice(0, 150);
    return limitedWords.join(' ');
  };

  const handleGenerateTransform = async () => {
    if (!currentText || isOverLimit || isLoading) return;
    
    // Clear any ongoing animation when transforming
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current);
      animationIntervalRef.current = null;
    }
    
    console.log("Starting transform with:", {
      text: currentText ? currentText.substring(0, 50) + "..." : "no text",
      transformationType,
      level, 
      isLecture: true,
      hasDocumentText: !!documentTextRef.current
    });

    setIsLoading(true);
    setError('');
    
    try {
      // Get a token for authentication
      let token;
      try {
        token = await getAccessTokenSilently({
          authorizationParams: {
            audience: import.meta.env.VITE_AUTH0_AUDIENCE,
            scope: 'openid profile email offline_access'
          }
        });
      } catch (tokenError: any) {
        console.error("Failed to get auth token:", tokenError);
        throw new Error("Authentication failed. Please try logging in again.");
      }
      
      // Limit document context to first 150 words
      const limitedDocumentContext = getLimitedDocumentContext(documentTextRef.current);
      
      // Create and log the request body
      const requestBody = {
        text: currentText,
        transformationType: transformationType,
        level: level,
        isLecture: true,
        documentText: limitedDocumentContext
      };
      
      // Log document text availability
      console.log("Document text availability check:", {
        originalLength: documentText ? documentText.length : 0,
        limitedLength: limitedDocumentContext ? limitedDocumentContext.length : 0,
        wordCount: limitedDocumentContext ? limitedDocumentContext.split(/\s+/).length : 0,
        sample: limitedDocumentContext ? limitedDocumentContext.substring(0, 100) + '...' : 'none'
      });
      
      const response = await fetch('https://clarity-backend-production.up.railway.app/api/transform', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store'
        },
        body: JSON.stringify(requestBody)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Check if it's a known API error format
        if (isApiError(data)) {
          throw new Error(data.detail);
        }
        throw new Error(`API error: ${response.statusText}`);
      }
      
      // Validate response data
      if (!isTransformResponse(data)) {
        throw new Error('Invalid API response format');
      }
      
      console.log("Transformed successfully:", data);
      
      // Set the transformed state first for visual indication
      setIsTransformed(true);
      console.log("Setting transformed state: true");
      
      // Clear current text to make room for animation
      setCurrentText('');
      
      // Start the word-by-word animation with validated response
      animateTextWordByWord(data.transformedText);
      
    } catch (err: any) {
      console.error("Transform error:", err);
      
      if (err.message.includes('login')) {
        setError('Your session has expired. Please log in again.');
      } else {
        setError(err.message || 'Failed to transform text. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle uploading another document
  const handleUploadAnother = () => {
    // Reset all document-related state
    setDocumentText(null);
    setCurrentText(null);
    setAnimatedText('');
    setCharacterCount(0);
    setIsOverLimit(false);
    setError(null);
    
    // Clear any ongoing animation
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current);
      animationIntervalRef.current = null;
    }
    
    // Reset the presentation viewer component
    if (presentationViewerRef.current) {
      presentationViewerRef.current.resetPresentation();
    }

    // Clear chat messages by resetting the SimpleChatView
    setActiveTab('understand'); // Switch back to understand tab
    // The chat will be cleared automatically when documentText becomes null
  };

  // Function to clear text selection
  const clearSelection = () => {
    setCurrentText(null);
    setCharacterCount(0);
    setIsTransformed(false);
    // Clear browser selection
    if (window.getSelection) {
      if (window.getSelection()?.empty) {  // Chrome
        window.getSelection()?.empty();
      } else if (window.getSelection()?.removeAllRanges) {  // Firefox
        window.getSelection()?.removeAllRanges();
      }
    }
  };

  // @ts-ignore - Panel resizing feature in development
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(50);
  const [isResizing, setIsResizing] = useState(false);
  
  // Update leftPanelWidth when tab changes
  useEffect(() => {
    if (activeTab === 'chat') {
      setLeftPanelWidth(30); // Start at 30% width when switching to chat
    } else {
      setLeftPanelWidth(50); // Reset to 50% for other tabs
    }
  }, [activeTab]);
  
  // Add resize handler
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const containerWidth = window.innerWidth;
      const percentage = (e.clientX / containerWidth) * 100;
      // Limit range between 30% and 70%
      setLeftPanelWidth(Math.min(Math.max(percentage, 30), 70));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const [copiedText, setCopiedText] = useState(false);

  // Reset copied state after 2 seconds
  useEffect(() => {
    if (copiedText) {
      const timer = setTimeout(() => {
        setCopiedText(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [copiedText]);

  const handleCopyText = async () => {
    if (currentText) {
      try {
        await navigator.clipboard.writeText(currentText);
        setCopiedText(true);
      } catch (err) {
        console.error('Failed to copy text:', err);
      }
    }
  };

  // Add state for transform button active state
  const [isTransformButtonActive, setIsTransformButtonActive] = useState(false);

  // Add function to handle transform completion
  const handleTransformComplete = () => {
    setIsTransformButtonActive(true);
    // Reset button color after 3 seconds
    setTimeout(() => {
      setIsTransformButtonActive(false);
    }, 3000);
  };

  // Add clear transformed text function
  const handleClearTransformed = () => {
    setIsTransformed(false);
  };

  // Handler for generating study guide
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

      const studyGuidePrompt = `Create a comprehensive study guide for this document in the following format:

1. Overview
- Write 2-3 sentences giving a high-level overview of the document's main topic and purpose

2. Key Terms
- List 5-10 important terms and their definitions from the document
- Format as a bullet list with term in bold followed by definition

3. Summary
- Provide 3-5 main points that summarize the key concepts
- Format as bullet points

4. Essay Questions
- Create 2-3 thought-provoking essay questions that test deep understanding
- Format as a numbered list

5. Quiz
• Quiz Questions:
- Create 5-10 multiple choice questions
- Format each question as:
Question: [The question text, including all options in the question itself]
<click to reveal answer>
Answer: [The correct answer with brief explanation]

CRITICAL FORMATTING RULES FOR MULTIPLE CHOICE QUESTIONS:
1. ALWAYS include all options directly in the question text
2. NEVER use separate a), b), c), d) options
3. Use commas or "or" to separate options
4. End the question with a question mark

Examples of CORRECT format:
✅ "Which of the following is not a lobe of the brain: temporal, frontal, occipital, or parietal?"
✅ "What is the largest organ in the human body: heart, brain, liver, or skin?"
✅ "Which of these is a primary color: red, blue, green, or yellow?"

Examples of INCORRECT format:
❌ "Which of the following is not a lobe of the brain?"
❌ "What is the largest organ in the human body?
a) heart
b) brain
c) liver
d) skin"

Use bullet points and clear formatting to make each section distinct.`;

      // First add the prompt as a user message
      setMessages(prev => [
        ...prev,
        {
          type: 'user',
          content: 'Please generate a study guide for this document.',
          isStudyGuide: true
        }
      ]);

      const response = await fetch(API_ENDPOINTS.chat.send, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: studyGuidePrompt,
          document_text: documentText
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate study guide');
      }

      const data = await response.json();

      // Add the response to the chat messages
      setMessages(prev => [
        ...prev,
        {
          type: 'assistant',
          content: data.message,
          isStudyGuide: true
        }
      ]);

    } catch (error) {
      console.error('Study guide generation error:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate study guide');
      
      // Add error message to chat
      setMessages(prev => [
        ...prev,
        {
          type: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Failed to generate study guide'}. Please try again.`,
          isStudyGuide: true
        }
      ]);
    } finally {
      setIsGeneratingStudyGuide(false);
    }
  };

  // Handler for generating briefing document
  const handleGenerateBriefing = async () => {
    if (!documentText || isGeneratingBriefing) return;
    
    setIsGeneratingBriefing(true);
    setError(null);

    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: 'openid profile email offline_access'
        }
      });

      const briefingPrompt = `Please create a concise briefing document that summarizes the key points of this text. Include:

1. Core Concepts (2-3 main ideas)
2. Key Themes (2-3 themes)
3. Practical Applications
4. Critical Considerations
5. Summary Implications

Format the output with clear headers and bullet points for readability.`;

      // First add the prompt as a user message
      setMessages(prev => [
        ...prev,
        {
          type: 'user',
          content: 'Please generate a briefing document.',
          isStudyGuide: false
        }
      ]);

      const response = await fetch(API_ENDPOINTS.chat.send, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: briefingPrompt,
          document_text: documentText
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate briefing');
      }

      const data = await response.json();

      // Add the response to the chat messages
      setMessages(prev => [
        ...prev,
        {
          type: 'assistant',
          content: data.message,
          isStudyGuide: false
        }
      ]);

    } catch (error) {
      console.error('Briefing generation error:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate briefing');
      
      // Add error message to chat
      setMessages(prev => [
        ...prev,
        {
          type: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Failed to generate briefing'}. Please try again.`,
          isStudyGuide: false
        }
      ]);
    } finally {
      setIsGeneratingBriefing(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'understand':
        return (
          <div className="p-4 h-full overflow-hidden">
            <div className="bg-white rounded-lg shadow-sm p-6 h-full flex flex-col">
              <div className="flex flex-col gap-4 flex-1 min-h-0">
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Transformation Type
                    </label>
                    <TransformationTypeSelect 
                      value={transformationType}
                      onChange={setTransformationType}
                    />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Level
                    </label>
                    <LevelSelect 
                      value={level} 
                      onChange={setLevel}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 flex-1 min-h-0">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-gray-700 flex items-center">
                      <span>{isTransformed ? 'Transformed Text' : 'Selected Text'}</span>
                      {isTransformed && (
                        <span className="ml-2 text-xs text-green-600 font-medium animate-pulse">
                          ✓ Transformed
                        </span>
                      )}
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopyText}
                        className={`p-1.5 text-gray-500 hover:text-gray-700 rounded transition-colors ${
                          !currentText ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        disabled={!currentText}
                        title="Copy text"
                      >
                        {copiedText ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <span className={`text-sm ${isOverLimit ? 'text-red-500' : 'text-gray-500'}`}>
                        {characterCount}/1000 characters
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <div 
                      className={`h-full overflow-y-auto p-4 border rounded-lg transition-all duration-500 ${
                        isTransformed 
                          ? 'bg-green-50 border-green-200 shadow-sm' 
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className={`transition-opacity duration-300 ${isLoading ? 'opacity-50' : 'opacity-100'}`}>
                        {currentText && !animatedText && (
                          <div className={isTransformed ? 'transformed-text' : ''} style={isTransformed ? styles.transformHighlight : {}}>
                            {currentText}
                          </div>
                        )}
                        {animatedText && (
                          <div 
                            className="transformed-text" 
                            style={styles.transformHighlight}
                            dangerouslySetInnerHTML={{ __html: animatedText }}
                          />
                        )}
                        {!currentText && !animatedText && (
                          <span className="text-gray-400">
                            No text selected. Select text from the document to transform it.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 transformation-controls mt-4">
                  <button
                    onClick={() => {
                      handleGenerateTransform();
                      handleTransformComplete();
                    }}
                    disabled={isLoading || isOverLimit || !currentText}
                    className={`transform-button px-4 py-2 rounded-lg text-white transition-colors ${
                      isTransformButtonActive 
                        ? 'bg-blue-700' 
                        : isLoading 
                          ? 'bg-gray-400 cursor-not-allowed' 
                          : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isLoading ? 'Transforming...' : `${TRANSFORMATION_DETAILS.find(t => t.id === transformationType)?.label || 'Transform'}`}
                  </button>
                  
                  {isTransformed && (
                    <button
                      onClick={handleClearTransformed}
                      className="px-4 py-2 rounded-lg text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {error && (
                  <p className="text-sm text-red-500">{error}</p>
                )}
              </div>
            </div>
          </div>
        );
      case 'chat':
        return (
          <div className="flex-1 p-4 h-full">
            <SimpleChatView
              currentText={currentText}
              documentText={documentText}
              selectedText={currentText}
              onClearSelection={clearSelection}
              isGeneratingStudyGuide={isGeneratingStudyGuide}
              isGeneratingBriefing={isGeneratingBriefing}
              onGenerateStudyGuide={handleGenerateStudyGuide}
              onGenerateBriefing={handleGenerateBriefing}
              messages={messages}
              setMessages={setMessages}
            />
          </div>
        );
      case 'teach':
        return (
          <div className="flex-1 p-4">
            <div className="bg-gray-50/80 backdrop-blur-xl rounded-2xl p-6">
              <p className="text-[15px] text-gray-600">
                Teach Me feature coming soon...
              </p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  // @ts-ignore - Mobile responsiveness feature in development
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Add useEffect for mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Check initial size
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Satisfy linter - these values are used in JSX
  useEffect(() => {
    if (typeof isOpen === 'boolean' && typeof toggle === 'function') {
      return;
    }
  }, [isOpen, toggle]);

  return (
    <FileProvider>
      <DashboardLayout>
        <div className="flex flex-col h-full">
          {/* Fixed header */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
            <div className="px-4 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h1 className="text-lg font-medium text-gray-900">Document Viewer</h1>
                  <button
                  onClick={handleUploadAnother}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Upload Another
                  </button>
                </div>
              <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('understand')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      activeTab === 'understand'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Brain className="w-4 h-4" />
                  Understand
                  </button>
                  <button
                    onClick={() => setActiveTab('chat')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      activeTab === 'chat'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4" />
                  Chat
                  </button>
                  <button
                    onClick={() => setActiveTab('teach')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      activeTab === 'teach'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Wand2 className="w-4 h-4" />
                  Teach Me
                </button>
              </div>
            </div>
          </div>
          
          {/* Mobile sidebar toggle button - centered on left edge */}
          <div className="fixed left-0 top-1/2 transform -translate-y-1/2 z-50 md:hidden">
            <button
              onClick={toggle}
              className="bg-white rounded-r-lg shadow-md p-2 flex items-center justify-center"
              aria-label="Toggle sidebar"
            >
              <svg
                className={`w-6 h-6 text-gray-600 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={isOpen ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'}
                />
              </svg>
            </button>
          </div>
          
          {/* Main content area - Modified to maintain horizontal layout on all screen sizes */}
          <div className="flex-1 overflow-hidden">
            <div className="flex h-full flex-row">
              {/* Document Viewer (Left Panel) - Modified width for smaller screens */}
              <div className="w-1/2 h-full border-r">
                <PresentationViewer 
                  ref={presentationViewerRef}
                  onTextSelect={handleTransform}
                    onDocumentTextExtracted={setDocumentText}
                  onReset={() => setDocumentText(null)}
                />
            </div>
            
              {/* Right Panel */}
              <div className="w-1/2 h-full">
              {renderContent()}
              </div>
            </div>
          </div>
        </div>
        
        <style dangerouslySetInnerHTML={{
          __html: `
            /* Override mobile styles to maintain horizontal layout */
            @media (max-width: 768px) {
              .header-container {
                display: flex !important;
                flex-direction: row !important;
                padding: 0.5rem 1rem !important;
                height: auto !important;
                position: relative !important;
                z-index: 10 !important;
              }
              
              .header-left {
                width: auto !important;
                display: flex !important;
                align-items: center !important;
              }
              
              .header-center {
                width: auto !important;
                margin-left: auto !important;
              }
              
              .header-tabs {
                display: flex !important;
                gap: 0.5rem !important;
              }
              
              /* Force horizontal layout */
              .content-container {
                display: flex !important;
                flex-direction: row !important;
                height: 100% !important;
                padding: 0 !important;
                overflow: hidden !important;
              }
              
              /* Document panel styles */
              .document-panel {
                width: 50% !important;
                height: 100% !important;
                min-height: 100% !important;
                position: relative !important;
                overflow: hidden !important;
              }
              
              /* Content panel styles */
              .content-panel {
                width: 50% !important;
                height: 100% !important;
                min-height: 100% !important;
                border-left: 1px solid #e5e7eb !important;
                margin-top: 0 !important;
                border-radius: 0 !important;
              }
              
              /* Ensure chat view has proper height */
              .SimpleChatView {
                height: 100% !important;
                display: flex !important;
                flex-direction: column !important;
              }
              
              /* Mobile sidebar styles - overlay rather than push content */
              .sidebar {
                position: fixed !important;
                z-index: 100 !important;
                top: 0 !important;
                left: 0 !important;
                bottom: 0 !important;
                width: 280px !important;
                transform: translateX(-100%) !important;
                transition: transform 0.3s ease-in-out !important;
                box-shadow: none !important;
              }
              
              .sidebar.open {
                transform: translateX(0) !important;
                box-shadow: 4px 0 10px rgba(0, 0, 0, 0.1) !important;
              }
              
              /* When sidebar is open on mobile, add overlay behind it */
              .sidebar-overlay {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: rgba(0, 0, 0, 0.5);
                z-index: 99;
                animation: fadeIn 0.3s ease-in-out;
              }
              
              .sidebar.open + .sidebar-overlay {
                display: block;
              }
              
              @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
            }
          `
        }} />
      </DashboardLayout>
    </FileProvider>
  );
};

export default LecturePage; 