import React from 'react';
import { Upload } from 'lucide-react';

interface TextInputProps {
  text: string;
  onTextChange: (text: string) => void;
}

const CHARACTER_LIMIT = 250;

export function TextInput({ text, onTextChange }: TextInputProps) {
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value.slice(0, CHARACTER_LIMIT);
    onTextChange(newText);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = (event.target?.result as string).slice(0, CHARACTER_LIMIT);
        onTextChange(text);
      };
      reader.readAsText(file);
    }
  };

  const charactersRemaining = CHARACTER_LIMIT - text.length;

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-medium text-gray-900">Input Text</h2>
        <label className="flex items-center gap-2 px-4 py-2 text-[13px] text-blue-600 bg-blue-50/50 rounded-lg cursor-pointer hover:bg-blue-50/80 transition-colors">
          <Upload size={16} />
          Upload File
          <input
            type="file"
            accept=".txt"
            className="hidden"
            onChange={handleFileUpload}
          />
        </label>
      </div>
      <div className="space-y-2">
        <textarea
          value={text}
          onChange={handleTextChange}
          className="w-full h-48 p-4 text-[15px] text-gray-900 bg-gray-50/50 border border-gray-200/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          placeholder="Enter or paste your text here..."
          maxLength={CHARACTER_LIMIT}
        />
        <div className="text-[13px] text-gray-500 text-right">
          {charactersRemaining} characters remaining
        </div>
      </div>
    </div>
  );
}