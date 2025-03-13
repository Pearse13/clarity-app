import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import '../../styles/animations.css';

export type TransformationType = 'simplify' | 'sophisticate' | 'casualise';

interface UnderstandOutputProps {
  level: number;
  onLevelChange: (level: number) => void;
  transformationType: TransformationType;
  onTransformationTypeChange: (type: TransformationType) => void;
  outputText: string;
  currentText: string | null;
  onTransform: () => void;
  isLoading?: boolean;
  characterCount: number;
  isOverLimit: boolean;
  error?: string | null;
}

const CHARACTER_LIMIT = 1000;

const UnderstandOutput: React.FC<UnderstandOutputProps> = ({
  level,
  onLevelChange,
  transformationType,
  onTransformationTypeChange,
  outputText,
  currentText,
  onTransform,
  isLoading = false,
  characterCount,
  isOverLimit,
  error
}) => {
  const [isLevelFocused, setIsLevelFocused] = React.useState(false);
  const [displayedText, setDisplayedText] = useState('');
  const [words, setWords] = useState<string[]>([]);

  // Split text into words when outputText changes
  useEffect(() => {
    if (outputText) {
      // First, clean up any level prefixes that might appear in the text
      let cleanedText = outputText;
      
      // Remove any "level: X" prefixes that might appear at the beginning
      cleanedText = cleanedText.replace(/^level:\s*\d+\s*/i, '');
      
      // Split by words while preserving whitespace
      const newWords = cleanedText.split(/(\s+)/).filter(word => word.length > 0);
      setWords(newWords);
      setDisplayedText(''); // Reset displayed text
    }
  }, [outputText]);

  // Animate words appearing one by one
  useEffect(() => {
    if (words.length > 0) {
      let currentIndex = 0;
      const interval = setInterval(() => {
        if (currentIndex < words.length) {
          setDisplayedText(prev => prev + words[currentIndex]);
          currentIndex++;
        } else {
          clearInterval(interval);
        }
      }, 50); // Adjust timing as needed

      return () => clearInterval(interval);
    }
  }, [words]);

  const getLevelDescription = (level: number, type: TransformationType) => {
    if (type === 'simplify') {
      switch (level) {
        case 1:
          return "Age 7-8 - Basic words and very short sentences";
        case 2:
          return "Age 10-11 - Simple words with subject-specific terms";
        case 3:
          return "Age 13-14 - Moderate vocabulary with mixed sentences";
        case 4:
          return "GCSE Level - Standard vocabulary with technical terms";
        case 5:
          return "A-Level - Clear but academically sophisticated";
        default:
          return "";
      }
    } else if (type === 'sophisticate') {
      switch (level) {
        case 1:
          return "Professional - Business language with moderate formality";
        case 2:
          return "Academic Undergraduate - Scholarly tone with theory";
        case 3:
          return "Academic Graduate - Advanced concepts and field terms";
        case 4:
          return "Expert/Specialist - Technical and complex frameworks";
        case 5:
          return "Advanced Academic - Sophisticated publication style";
        default:
          return "";
      }
    } else if (type === 'casualise') {
      switch (level) {
        case 1:
          return "Friendly - Light and approachable tone";
        case 2:
          return "Conversational - Natural speaking style";
        case 3:
          return "Informal - Relaxed and personal";
        case 4:
          return "Casual - Very relaxed with common phrases";
        case 5:
          return "Ultra-Casual - Colloquial and expressive";
        default:
          return "";
      }
    }
    return "";
  };

  const transformationTypes = [
    { value: 'simplify', label: 'Simplify' },
    { value: 'sophisticate', label: 'Sophisticate' },
    { value: 'casualise', label: 'Casualise' }
  ] as const;

  // Render words with animation
  const renderAnimatedText = () => {
    if (!displayedText) return null;
    
    // Process the text to ensure proper paragraph formatting
    // Split by newlines first to preserve paragraph structure
    const paragraphs = displayedText.split(/\n+/);
    
    return (
      <>
        {paragraphs.map((paragraph, pIndex) => {
          // Skip empty paragraphs
          if (!paragraph.trim()) return <br key={`p-${pIndex}`} />;
          
          // For each paragraph, animate the words
          return (
            <p key={`p-${pIndex}`} className="mb-4">
              {paragraph.split(/(\s+)/).map((word, wIndex) => (
                <span
                  key={`${pIndex}-${wIndex}`}
                  className="animate-typing"
                  style={{ '--word-index': wIndex } as React.CSSProperties}
                >
                  {word}
                </span>
              ))}
            </p>
          );
        })}
      </>
    );
  };

  return (
    <div className="flex flex-col p-8 bg-white rounded-lg border-2 border-blue-300">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap gap-6">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transformation Type
            </label>
            <select
              value={transformationType}
              onChange={(e) => onTransformationTypeChange(e.target.value as TransformationType)}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {transformationTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Level
            </label>
            <select
              value={level}
              onChange={(e) => onLevelChange(Number(e.target.value))}
              onFocus={() => setIsLevelFocused(true)}
              onBlur={() => setIsLevelFocused(false)}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Array.from({ length: 5 }, (_, i) => i + 1).map((lvl) => {
                const description = getLevelDescription(lvl, transformationType);
                let shortLabel = '';
                
                if (transformationType === 'simplify') {
                  if (lvl <= 3) {
                    shortLabel = `Level ${lvl} - ${description.split(' - ')[0]}`;
                  } else if (lvl === 4) {
                    shortLabel = `Level ${lvl} - GCSE Level`;
                  } else {
                    shortLabel = `Level ${lvl} - A-Level`;
                  }
                } else {
                  shortLabel = `Level ${lvl} - ${description.split('-')[0].trim()}`;
                }

                return (
                  <option key={lvl} value={lvl} title={description}>
                    {isLevelFocused
                      ? `Level ${lvl} - ${description}`
                      : shortLabel}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
        
        <div className="flex-grow">
          <div className="flex justify-between items-center mb-3">
            <label className="block text-sm font-medium text-gray-700">
              Selected Text
            </label>
            <span className={`text-sm ${isOverLimit ? 'text-red-500' : 'text-gray-500'}`}>
              {characterCount}/{CHARACTER_LIMIT} characters
            </span>
          </div>
          <div style={{ height: '1000px' }} className="w-full">
            <div className="w-full h-full bg-gray-50 border border-gray-200 rounded-lg overflow-auto">
              <div className="p-4 min-h-full whitespace-pre-wrap">
                {currentText || 'No text selected'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col mt-6">
        <div className="flex justify-between items-center mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Transformed Text
          </label>
          <button
            onClick={onTransform}
            disabled={!currentText || isOverLimit || isLoading}
            className={`px-4 py-2 text-sm font-medium rounded-lg transform transition-transform duration-100
              ${
                !currentText || isOverLimit || isLoading
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:scale-[1.02]'
              }`}
          >
            {isLoading ? 'Transforming...' : 'Transform'}
          </button>
        </div>

        <div className="min-h-[300px] p-6 bg-gray-50 border border-gray-200 rounded-lg">
          {error ? (
            <div className="flex items-start gap-3 text-red-600 mb-4">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin text-4xl text-gray-400">↻</div>
            </div>
          ) : displayedText ? (
            <div className="prose max-w-none">
              {renderAnimatedText()}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              <p>Transformed text will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UnderstandOutput;