import React, { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import DashboardLayout from '../../components/DashboardLayout';
import { FileProvider } from '../../contexts/FileContext';
import FileUpload from './FileUpload';
import UnderstandOutput, { TransformationType } from './UnderstandOutput';
import FeatureSelector from './FeatureSelector';
import { apiService } from '../../services/api';

type FeatureOption = 'understand' | 'chat' | 'create';

const LecturePage: React.FC = () => {
  const { getAccessTokenSilently, loginWithRedirect } = useAuth0();
  const [selectedOption, setSelectedOption] = useState<FeatureOption>('understand');
  const [level, setLevel] = useState<number>(1);
  const [transformationType, setTransformationType] = useState<TransformationType>('simplify');
  const [outputText, setOutputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [characterCount, setCharacterCount] = useState<number>(0);
  const [isOverLimit, setIsOverLimit] = useState<boolean>(false);
  const [currentText, setCurrentText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTransform = (text: string) => {
    setCurrentText(text);
    setCharacterCount(text.length);
    setIsOverLimit(text.length > 1000);
    setError(null);
  };

  const handleGenerateTransform = async () => {
    if (!currentText || isOverLimit) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: 'openid profile email offline_access'
        }
      });

      const response = await apiService.transformText({
        text: currentText,
        transformationType,
        level,
        isLecture: true
      }, token);

      setOutputText(response.transformedText);
    } catch (err: any) {
      console.error('Transform error:', err);
      
      // Handle missing refresh token error
      if (err.message?.includes('Missing Refresh Token')) {
        setError('Your session has expired. Please log in again.');
        // Redirect to login after a short delay
        setTimeout(() => {
          loginWithRedirect({
            appState: { returnTo: window.location.pathname }
          });
        }, 2000);
        return;
      }
      
      setError('Unable to process text at the moment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex-1 flex flex-col h-[calc(100vh-4rem)]">
        <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
          <FileProvider>
            <div className="flex-1 min-h-0">
              <FileUpload onTextLoaded={handleTransform} />
            </div>
            <div className="flex-1 min-h-0">
              {selectedOption === 'understand' ? (
                <UnderstandOutput
                  level={level}
                  onLevelChange={setLevel}
                  transformationType={transformationType}
                  onTransformationTypeChange={setTransformationType}
                  outputText={outputText}
                  currentText={currentText}
                  onTransform={handleGenerateTransform}
                  isLoading={isLoading}
                  characterCount={characterCount}
                  isOverLimit={isOverLimit}
                  error={error}
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