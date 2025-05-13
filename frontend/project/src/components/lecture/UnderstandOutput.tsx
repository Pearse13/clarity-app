import React from 'react';
import LoadingSpinner from '../LoadingSpinner';

interface UnderstandOutputProps {
  transformedText: string;
  isLoading: boolean;
  error: string | null;
}

const UnderstandOutput: React.FC<UnderstandOutputProps> = ({
  transformedText,
  isLoading,
  error
}) => {
  return (
    <div className="h-full flex flex-col">
      {/* Output display */}
      <div className="flex-1 overflow-y-auto p-4 bg-white rounded-lg shadow">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="text-red-500">{error}</div>
        ) : transformedText ? (
          <div className="whitespace-pre-wrap">{transformedText}</div>
        ) : (
          <div className="text-gray-500 text-center">
            Transform text to see the output here
          </div>
        )}
      </div>
    </div>
  );
};

export default UnderstandOutput;