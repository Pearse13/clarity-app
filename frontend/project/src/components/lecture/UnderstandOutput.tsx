import React from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';

export type TransformationType = 'simplify' | 'sophisticate' | 'casualise' | 'formalise';

interface UnderstandOutputProps {
  level: number;
  onLevelChange: (level: number) => void;
  transformationType: TransformationType;
  onTransformationTypeChange: (type: TransformationType) => void;
  outputText: string;
  isLoading?: boolean;
  onGenerate: () => void;
  characterCount: number;
  isOverLimit: boolean;
}

const CHARACTER_LIMIT = 1000;

const UnderstandOutput: React.FC<UnderstandOutputProps> = ({
  level,
  onLevelChange,
  transformationType,
  onTransformationTypeChange,
  outputText,
  isLoading = false,
  onGenerate,
  characterCount,
  isOverLimit
}) => {
  const getLevelDescription = (level: number) => {
    switch (level) {
      case 1:
        return "Basic - 5th grade level";
      case 2:
        return "Simple - 7th grade level";
      case 3:
        return "Moderate - 9th grade level";
      case 4:
        return "Advanced - 11th grade level";
      case 5:
        return "Complex - College level";
      default:
        return "";
    }
  };

  const transformationTypes: { value: TransformationType; label: string }[] = [
    { value: 'simplify', label: 'Simplify' },
    { value: 'sophisticate', label: 'Sophisticate' },
    { value: 'casualise', label: 'Casualise' },
    { value: 'formalise', label: 'Formalise' }
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm p-8">
      <div className="mb-6 space-y-4">
        {/* Transformation Type Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Transformation Type
          </label>
          <div className="relative">
            <select
              value={transformationType}
              onChange={(e) => onTransformationTypeChange(e.target.value as TransformationType)}
              className="w-full appearance-none bg-white border border-gray-200 rounded-lg py-2 px-4 text-sm text-gray-900 cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {transformationTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
        </div>

        {/* Level Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Comprehension Level
          </label>
          <div className="relative">
            <select
              value={level}
              onChange={(e) => onLevelChange(Number(e.target.value))}
              className="w-full appearance-none bg-white border border-gray-200 rounded-lg py-2 px-4 text-sm text-gray-900 cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {[1, 2, 3, 4, 5].map(lvl => (
                <option key={lvl} value={lvl}>
                  Level {lvl} - {getLevelDescription(lvl)}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="relative">
        <div className={`rounded-lg border bg-white transition-opacity duration-200 ${isLoading ? 'opacity-50' : ''}`}>
          <div className="flex items-center justify-between border-b p-4">
            <h3 className="text-sm font-medium text-gray-900">
              Transformed Output
            </h3>
            <div className={`text-xs ${isOverLimit ? 'text-red-500' : 'text-gray-500'}`}>
              {characterCount}/{CHARACTER_LIMIT} characters
            </div>
          </div>
          <div className="p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin text-blue-600">↻</div>
                <span className="ml-2 text-sm text-gray-600">Processing...</span>
              </div>
            ) : outputText ? (
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{outputText}</p>
            ) : (
              <p className="text-sm text-gray-500 text-center py-8">
                Select options and upload a file to see the transformed version
              </p>
            )}
          </div>
        </div>

        {isOverLimit && (
          <div className="flex items-center gap-2 mt-2 text-red-500 text-xs">
            <AlertCircle className="w-4 h-4" />
            <span>Text exceeds {CHARACTER_LIMIT} character limit</span>
          </div>
        )}

        <button
          onClick={onGenerate}
          disabled={isLoading || isOverLimit || !outputText}
          className={`mt-4 w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors
            ${isLoading || isOverLimit || !outputText
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
        >
          {isLoading ? 'Processing...' : 'Generate Transform'}
        </button>
      </div>
    </div>
  );
};

export default UnderstandOutput; 