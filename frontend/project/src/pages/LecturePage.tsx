import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import DashboardLayout from '../components/DashboardLayout';
import FileUpload from '../components/lecture/FileUpload';
import FeatureSelector from '../components/lecture/FeatureSelector';
import UnderstandOutput, { TransformationType } from '../components/lecture/UnderstandOutput';
import { FileProvider } from '../contexts/FileContext';

const CHARACTER_LIMIT = 1000;

const LecturePage: React.FC = () => {
  const { getAccessTokenSilently } = useAuth0();
  const [selectedOption, setSelectedOption] = useState<'understand' | 'chat' | 'create'>('understand');
  const [level, setLevel] = useState(3); // Default to moderate level
  const [transformationType, setTransformationType] = useState<TransformationType>('simplify');
  const [outputText, setOutputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentText, setCurrentText] = useState<string | null>(null);
  const [characterCount, setCharacterCount] = useState(0);

  const isOverLimit = characterCount > CHARACTER_LIMIT;

  const handleTransform = async (text: string) => {
    setCurrentText(text);
    setCharacterCount(text.length);
    
    if (text.length <= CHARACTER_LIMIT) {
      await generateTransform(text);
    }
  };

  const generateTransform = async (text: string = currentText || '') => {
    if (!text || isOverLimit) return;

    setIsLoading(true);
    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/transformText`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text,
          transformationType,
          level
        })
      });

      if (!response.ok) {
        throw new Error('Transform request failed');
      }

      const data = await response.json();
      setOutputText(data.transformedText);
    } catch (error) {
      console.error('Transform error:', error);
      setOutputText('Error processing text. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex-1">
        <h1 className="text-2xl font-semibold">Clarity.lecture</h1>
        <div className="mt-6 flex flex-col lg:flex-row gap-6">
          <FileProvider>
            <div className="w-full lg:w-1/2">
              <FileUpload onTextLoaded={handleTransform} />
            </div>
            <div className="w-full lg:w-1/2 flex flex-col gap-6">
              {selectedOption === 'understand' ? (
                <UnderstandOutput
                  level={level}
                  onLevelChange={setLevel}
                  transformationType={transformationType}
                  onTransformationTypeChange={setTransformationType}
                  outputText={outputText}
                  isLoading={isLoading}
                  onGenerate={() => generateTransform()}
                  characterCount={characterCount}
                  isOverLimit={isOverLimit}
                />
              ) : (
                <FeatureSelector 
                  selectedOption={selectedOption}
                  onOptionSelect={setSelectedOption}
                />
              )}
            </div>
          </FileProvider>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default LecturePage; 