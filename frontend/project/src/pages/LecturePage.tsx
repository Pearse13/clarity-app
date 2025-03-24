import React, { useState, useEffect, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Brain, MessageSquare, Wand2, ChevronDown, Upload } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { FileProvider } from '../contexts/FileContext';
import PresentationViewer from '../components/presentation/PresentationViewer';
import { TransformationType } from '../components/lecture/UnderstandOutput';
import SimpleChatView from '../components/lecture/SimpleChatView';
import { API_ENDPOINTS } from '../config/api';

type ActiveTab = 'understand' | 'chat' | 'create';

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

  // Function to animate text word by word
  const animateTextWordByWord = (text: string) => {
    // Clear any existing animation
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current);
    }
    
    setAnimatedText('');
    const words = text.split(' ');
    let currentWordIndex = 0;
    
    // Create new interval for word-by-word animation
    const intervalId = setInterval(() => {
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

  // Enhanced text selection handler to work across all tabs
  const handleGlobalTextSelection = () => {
    // Don't capture selections if we're already loading or in a transformed state
    if (isLoading || isTransformed) return;
    
    // Get the current selection
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    
    if (selectedText && selectedText.length > 1) {
      console.log('LecturePage: Text selected globally:', selectedText);
      
      // Check if the selection is from the document viewer area
      const selectionNode = selection?.anchorNode?.parentElement;
      const isPdfArea = selectionNode?.closest('.react-pdf__Page') || 
                       selectionNode?.closest('.document-viewer-area');
      
      if (isPdfArea) {
        console.log('LecturePage: Selection is from document area');
        handleTransform(selectedText);
      }
    }
  };

  // Function to check if the user is trying to select text by clicking and dragging
  useEffect(() => {
    let isSelecting = false;
    let selectionTimer: NodeJS.Timeout | null = null;
    let selectionStartTarget: EventTarget | null = null;

    const handleMouseDown = (e: MouseEvent) => {
      // User has started a potential selection
      isSelecting = true;
      selectionStartTarget = e.target;
      
      // Clear any existing timer
      if (selectionTimer) {
        clearTimeout(selectionTimer);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (isSelecting) {
        // Only process if same area or if it's within a PDF viewer
        const isInDocumentArea = 
          e.target === selectionStartTarget ||
          (e.target as HTMLElement).closest('.react-pdf__Page') ||
          (e.target as HTMLElement).closest('iframe') ||
          (e.target as HTMLElement).closest('.document-viewer-area');
        
        if (isInDocumentArea) {
          // User has potentially completed a selection, check after a short delay
          selectionTimer = setTimeout(() => {
            const selection = window.getSelection();
            const selectedText = selection?.toString().trim();
            
            if (selectedText && selectedText.length > 1) {
              console.log('LecturePage: Text selected from document:', selectedText);
              handleTransform(selectedText);
            }
          }, 200); // Increased timeout for better selection capture
        }
      }
      
      isSelecting = false;
      selectionStartTarget = null;
    };

    // Add global selection change handler
    const handleSelectionChange = () => {
      // Clear any existing timer to prevent duplicates
      if (selectionTimer) {
        clearTimeout(selectionTimer);
      }
      
      // Set a new timer to capture the selection after it's complete
      selectionTimer = setTimeout(handleGlobalTextSelection, 300);
    };

    // Add the event listeners with capture phase to ensure we get events first
    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('mouseup', handleMouseUp, true);
    document.addEventListener('selectionchange', handleSelectionChange);
    
    return () => {
      // Clean up
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('mouseup', handleMouseUp, true);
      document.removeEventListener('selectionchange', handleSelectionChange);
      
      if (selectionTimer) {
        clearTimeout(selectionTimer);
      }
    };
  }, [isLoading, isTransformed]);

  // Add this useEffect to handle document clicks for text unselection
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      // Skip if we're currently loading or showing transformed text - don't clear text
      if (isLoading || isTransformed) {
        return;
      }
      
      // Check if the click is outside text areas or selection-related elements
      const target = e.target as HTMLElement;
      const isSelectionRelated = 
        target.closest('.react-pdf__Page') || 
        target.closest('textarea') ||
        target.closest('input[type="text"]') ||
        target.closest('[contenteditable="true"]') ||
        // Also prevent clearing text when clicking the transform button
        target.closest('button[id="transform-button"]');
      
      // If click is outside selection-related elements, clear the current text
      if (!isSelectionRelated && currentText) {
        setCurrentText('');
        setCharacterCount(0);
      }
    };
    
    // Add click listener to the document
    document.addEventListener('mousedown', handleDocumentClick);
    
    // Cleanup on unmount
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
    };
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
        token = await getAccessTokenSilently();
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
      
      console.log("Sending request body:", {
        ...requestBody,
        documentText: limitedDocumentContext ? `${limitedDocumentContext.length} chars (first 150 words)` : null
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
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error from API: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("Transformed successfully:", data);
      
      // Set the transformed state first for visual indication
      setIsTransformed(true);
      console.log("Setting transformed state: true");
      
      // Clear current text to make room for animation
      setCurrentText('');
      
      // Start the word-by-word animation
      animateTextWordByWord(data.text);
      
    } catch (err: any) {
      console.error("Transform error:", err);
      
      if (err.message.includes('login')) {
        setError('Your session has expired. Please log in again.');
      } else {
        setError('Failed to transform text. Please try again.');
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
                    <span className={`text-sm ${isOverLimit ? 'text-red-500' : 'text-gray-500'}`}>
                      {characterCount}/1000 characters
                    </span>
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

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleGenerateTransform();
                    }}
                    disabled={isLoading || isOverLimit || !currentText}
                    id="transform-button"
                    className={`px-4 py-2 rounded-lg text-white font-medium transition-all duration-300 ${
                      isTransformed 
                        ? 'bg-green-600 hover:bg-green-700' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    } ${(isLoading || isOverLimit || !currentText) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isLoading ? (
                      <span className="flex items-center">
                        <span className="mr-2">Loading...</span>
                        <span className="animate-spin">⟳</span>
                      </span>
                    ) : isTransformed ? (
                      <span className="flex items-center">
                        <span className="mr-2">Transformed</span>
                        <span>✓</span>
                      </span>
                    ) : (
                      'Transform'
                    )}
                  </button>
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
      case 'create':
        return (
          <div className="flex-1 p-4">
            <div className="bg-gray-50/80 backdrop-blur-xl rounded-2xl p-6">
              <p className="text-[15px] text-gray-600">
                Create feature coming soon...
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
                    onClick={() => setActiveTab('create')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                      activeTab === 'create'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Wand2 className="w-4 h-4" />
                    <span>Create</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex-grow grid grid-cols-1 lg:grid-cols-2 h-full overflow-hidden">
            <div className="h-full overflow-hidden bg-gray-50 flex flex-col p-4">
              <div className="flex-1 overflow-hidden">
                <PresentationViewer 
                  ref={presentationViewerRef}
                  onTextSelect={handleTransform}
                  onDocumentTextExtracted={(text) => {
                    if (text) {
                      console.log('Extracted document text, length:', text.length, 'First 50 chars:', text.substring(0, 50));
                      setDocumentText(text);
                      
                      // Verify the ref is updated
                      setTimeout(() => {
                        console.log('Document text ref after update:', 
                          documentTextRef.current ? 
                          `${documentTextRef.current.length} chars` : 
                          'null');
                      }, 100);
                    }
                  }}
                  onReset={() => setDocumentText(null)}
                />
              </div>
            </div>
            
            <div className="flex-1 flex flex-col h-full overflow-hidden border-l border-gray-200 bg-white">
              {renderContent()}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </FileProvider>
  );
};

export default LecturePage; 