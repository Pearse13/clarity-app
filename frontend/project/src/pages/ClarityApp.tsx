import React, { useState } from 'react';
import { TextInput } from '@/components/TextInput';
import { TransformedText } from '@/components/TransformedText';

const ClarityApp: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [simplifyLevel, setSimplifyLevel] = useState(1);
  const [sophisticateLevel, setSophisticateLevel] = useState(1);
  const [simpleText, setSimpleText] = useState('');
  const [sophisticatedText, setSophisticatedText] = useState('');

  const handleGenerate = async (isSimplifying: boolean): Promise<void> => {
    // TODO: Implement API call
    if (isSimplifying) {
      setSimpleText('Simple version of: ' + inputText);
    } else {
      setSophisticatedText('Sophisticated version of: ' + inputText);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Clarity Text Transformer</h1>
      <div className="space-y-6">
        <TextInput 
          text={inputText}
          onTextChange={setInputText}
        />
        <div className="grid grid-cols-2 gap-6">
          <TransformedText 
            text={simpleText}
            title="Simplified Version"
            complexityLevel={simplifyLevel}
            onComplexityChange={setSimplifyLevel}
            isSimplifying={true}
            onGenerate={() => handleGenerate(true)}
            canGenerate={inputText.length > 0}
          />
          <TransformedText 
            text={sophisticatedText}
            title="Sophisticated Version"
            complexityLevel={sophisticateLevel}
            onComplexityChange={setSophisticateLevel}
            isSimplifying={false}
            onGenerate={() => handleGenerate(false)}
            canGenerate={inputText.length > 0}
          />
        </div>
      </div>
    </div>
  );
};

export default ClarityApp; 