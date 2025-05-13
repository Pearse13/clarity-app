// import React from 'react';
import { Copy, Wand2 } from 'lucide-react';
import { ComplexitySelector } from './ComplexitySelector';

interface TransformedTextProps {
  text: string;
  title: string;
  complexityLevel: number;
  onComplexityChange: (level: number) => void;
  isSimplifying: boolean;
  onGenerate: () => void;
  canGenerate: boolean;
}

export function TransformedText({ 
  text, 
  title, 
  complexityLevel, 
  onComplexityChange,
  isSimplifying,
  onGenerate,
  canGenerate
}: TransformedTextProps) {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-medium text-gray-900">{title}</h2>
        <button
          onClick={copyToClipboard}
          disabled={!text}
          className="flex items-center gap-2 px-4 py-2 text-[13px] text-gray-600 bg-gray-50/50 rounded-lg hover:bg-gray-50/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Copy size={16} />
          Copy
        </button>
      </div>
      <ComplexitySelector
        value={complexityLevel}
        onChange={onComplexityChange}
        label="Complexity Level"
        isSimplifying={isSimplifying}
      />
      <div className="w-full h-48 p-4 bg-gray-50/50 text-[15px] text-gray-900 border border-gray-200/50 rounded-lg overflow-auto">
        {text || <span className="text-gray-400">Click generate to transform the text...</span>}
      </div>
      <button
        onClick={onGenerate}
        disabled={!canGenerate}
        className="w-full py-3 px-4 bg-blue-600 text-[13px] font-medium text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        <Wand2 size={16} />
        Generate {isSimplifying ? 'Simple' : 'Sophisticated'} Version
      </button>
    </div>
  );
}