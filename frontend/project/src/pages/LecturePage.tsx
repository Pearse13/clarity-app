import React, { useState, useEffect, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Brain, MessageSquare, Wand2, ChevronDown, Upload, Copy, Check } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { FileProvider } from '../contexts/FileContext';
import PresentationViewer from '../components/presentation/PresentationViewer';
import { TransformationType } from '../components/lecture/UnderstandOutput';
import SimpleChatView from '../components/lecture/SimpleChatView';
import { useSidebar } from '../contexts/SidebarContext';
import { isTransformResponse, isApiError } from '../types/api';

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

const LecturePage: React.FC = () => {
  const { getAccessTokenSilently } = useAuth0();
  const { isOpen, toggle } = useSidebar();
  const [activeTab, setActiveTab] = useState<ActiveTab>('understand');
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
  const presentationViewerRef = useRef<PresentationViewerRefType>(null);
  
  // Reference for the animation interval
  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Create ref to avoid closure issues in event handlers
  const documentTextRef = useRef<string | null>(null);
  
  // Update ref when state changes
  useEffect(() => {
    documentTextRef.current = documentText;
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
    console.log('LecturePage: handleTransform called with text:', text);
    
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
    if (isLoading || isTransformed) return;

    const target = e.target as HTMLElement;
    const isTextArea = target.closest('.text-area') || 
                      target.closest('.react-pdf__Page') ||
                      target.closest('.transform-button') ||
                      target.closest('.transformation-controls') ||
                      target.closest('.transformed-text') ||
                      target.closest('.level-select') ||
                      target.closest('.transformation-type-select');

    if (!isTextArea && currentText) {
      setCurrentText(null);
      setCharacterCount(0);
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

  // Add state for panel width
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
  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeTab !== 'chat') return;
    setIsResizing(true);
    e.preventDefault();
  };

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

  const renderContent = () => {
    switch (activeTab) {
      case 'understand':
        return (
          <div className="p-4 h-full">
            <div className="bg-white rounded-lg shadow-sm p-6 h-full flex flex-col">
              <div className="flex flex-col gap-4 flex-1">
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

                <div className="flex flex-col gap-2 flex-1">
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
                  <div className="flex-1 min-h-0">
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

                <div className="flex items-center gap-2 transformation-controls">
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

  return (
    <FileProvider>
      <DashboardLayout>
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes highlightFadeIn {
              0% { background-color: rgba(236, 253, 245, 0); }
              50% { background-color: rgba(236, 253, 245, 0.5); }
              100% { background-color: rgba(236, 253, 245, 0.2); }
            }
            
            .transformed-text {
              animation: highlightFadeIn 0.8s ease-in-out;
              transition: all 0.3s ease;
              padding: 4px;
              border-radius: 4px;
            }
            
            @keyframes wordAppear {
              0% { opacity: 0; transform: translateY(8px); }
              100% { opacity: 1; transform: translateY(0); }
            }
            
            .animated-word {
              display: inline-block;
              animation: wordAppear 0.4s ease-out forwards;
              color: #059669;
              font-weight: 500;
            }
          `
        }} />
        <div className="flex-grow flex flex-col h-full overflow-hidden">
          <div className="flex-none bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center">
              {/* Left half of the header */}
              <div className="w-1/2 flex items-center gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle();
                  }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Toggle sidebar"
                >
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform duration-300 transform-gpu ${isOpen ? '' : 'rotate-180'}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                    />
                  </svg>
                </button>
                <h1 className="text-xl font-medium text-gray-900">Document Viewer</h1>
                {documentText && (
                  <button
                    onClick={handleUploadAnother}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm bg-gray-100 text-gray-700 hover:bg-gray-200"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload Another</span>
                  </button>
                )}
              </div>
              
              {/* Right half of the header */}
              <div className="w-1/2 flex justify-center">
                <div className="flex gap-4">
                  <button
                    onClick={() => setActiveTab('understand')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                      activeTab === 'understand'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Brain className="w-4 h-4" />
                    <span>Understand</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('chat')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                      activeTab === 'chat'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Chat</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('teach')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                      activeTab === 'teach'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Wand2 className="w-4 h-4" />
                    <span>Teach Me</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex-grow flex h-full overflow-hidden">
            <div 
              className="h-[95%] overflow-hidden bg-gray-50 flex flex-col p-4"
              style={{ width: activeTab === 'chat' ? `${leftPanelWidth}%` : '50%' }}
            >
              <div className="flex-1 overflow-hidden">
                <PresentationViewer 
                  ref={presentationViewerRef}
                  onTextSelect={handleTransform}
                  onDocumentTextExtracted={(text) => {
                    if (text) {
                      setDocumentText(text);
                    }
                  }}
                  onReset={() => setDocumentText(null)}
                  isMinimized={activeTab === 'chat'}
                  activeTab={activeTab as 'understand' | 'chat' | 'teach'}
                />
              </div>
            </div>
            
            {/* Add resize handle */}
            {activeTab === 'chat' && (
              <div
                className="w-1 cursor-col-resize hover:bg-blue-400 transition-colors"
                onMouseDown={handleMouseDown}
                style={{ 
                  cursor: 'col-resize',
                  backgroundColor: isResizing ? '#60A5FA' : '#E5E7EB'
                }}
              />
            )}
            
            <div 
              className="flex-1 flex flex-col h-[95%] overflow-hidden border-l border-gray-200 bg-white"
              style={{ width: activeTab === 'chat' ? `${100 - leftPanelWidth}%` : '50%' }}
            >
              {renderContent()}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </FileProvider>
  );
};

export default LecturePage; 