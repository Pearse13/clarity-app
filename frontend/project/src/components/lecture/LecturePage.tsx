import React, { useState } from 'react';
import FileUpload from './FileUpload';
import UnderstandOutput from './UnderstandOutput';
import FeatureSelector from './FeatureSelector';
import DashboardLayout from '../../components/DashboardLayout';
import { FileProvider } from '../../contexts/FileContext';

type FeatureOption = 'understand' | 'chat' | 'create';

const LecturePage: React.FC = () => {
  const [selectedOption, setSelectedOption] = useState<FeatureOption>('understand');
  const [error, setError] = useState<string | null>(null);

  const handleTransform = () => {
    setError(null);
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
                  transformedText=""
                  isLoading={false}
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