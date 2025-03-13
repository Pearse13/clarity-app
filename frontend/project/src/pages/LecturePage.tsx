import React, { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';
import { Brain, MessageSquare, Wand2, ChevronDown } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { FileProvider } from '../contexts/FileContext';
import PresentationViewer from '../components/presentation/PresentationViewer';
import { TransformationType } from '../components/lecture/UnderstandOutput';

type ActiveTab = 'understand' | 'chat' | 'create';

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

const LecturePage: React.FC = () => {
  const { getAccessTokenSilently, loginWithRedirect } = useAuth0();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ActiveTab>('understand');
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

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/transform`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text: currentText,
          transformationType: transformationType,
          level,
          isLecture: true
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Transform request failed');
      }

      await new Promise(resolve => setTimeout(resolve, 300));
      setOutputText(data.transformedText);
    } catch (err: any) {
      console.error('Transform error:', err);
      
      if (err.message?.includes('Missing Refresh Token')) {
        setError('Your session has expired. Please log in again.');
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
                    <select
                      value={transformationType}
                      onChange={(e) => setTransformationType(e.target.value as TransformationType)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="simplify">Simplify</option>
                      <option value="sophisticate">Sophisticate</option>
                      <option value="casualise">Casualise</option>
                    </select>
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
                    <label className="block text-sm font-medium text-gray-700">
                      Selected Text
                    </label>
                    <span className={`text-sm ${isOverLimit ? 'text-red-500' : 'text-gray-500'}`}>
                      {characterCount}/1000 characters
                    </span>
                  </div>
                  <div className="flex-1 min-h-0">
                    <div className="h-full overflow-y-auto p-4 border border-gray-200 rounded-lg bg-gray-50">
                      {currentText || (
                        <span className="text-gray-400">
                          Select text from your document to transform it...
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleGenerateTransform}
                  disabled={!currentText || isOverLimit || isLoading}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    !currentText || isOverLimit || isLoading
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isLoading ? 'Transforming...' : 'Transform Text'}
                </button>

                {error && (
                  <p className="text-sm text-red-500">{error}</p>
                )}

                {outputText && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Transformed Text
                    </label>
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg whitespace-pre-wrap h-[400px] overflow-y-auto">
                      {outputText}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      case 'chat':
        return (
          <div className="flex-1 p-4">
            <div className="bg-gray-50/80 backdrop-blur-xl rounded-2xl p-6">
              <p className="text-[15px] text-gray-600">
                Chat feature coming soon...
              </p>
            </div>
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
    }
  };

  return (
    <DashboardLayout>
      <div className="flex-1 flex h-[calc(100vh-4rem)]">
        {/* Left Side - File Upload/Viewer */}
        <div className="w-1/2 h-full border-r border-gray-200">
          <FileProvider>
            <PresentationViewer onTextSelect={handleTransform} />
          </FileProvider>
        </div>

        {/* Right Side */}
        <div className="w-1/2 h-full flex flex-col">
          {/* Navigation Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab('understand')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-colors ${
                  activeTab === 'understand'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-50/80 backdrop-blur-xl text-gray-600 hover:bg-gray-50/90'
                }`}
              >
                <Brain className="w-4 h-4 stroke-[1.5]" />
                Understand
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-colors ${
                  activeTab === 'chat'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-50/80 backdrop-blur-xl text-gray-600 hover:bg-gray-50/90'
                }`}
              >
                <MessageSquare className="w-4 h-4 stroke-[1.5]" />
                Chat
              </button>
              <button
                onClick={() => setActiveTab('create')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-colors ${
                  activeTab === 'create'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-50/80 backdrop-blur-xl text-gray-600 hover:bg-gray-50/90'
                }`}
              >
                <Wand2 className="w-4 h-4 stroke-[1.5]" />
                Create
              </button>
            </div>
          </div>

          {/* Content Area */}
          {renderContent()}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default LecturePage; 