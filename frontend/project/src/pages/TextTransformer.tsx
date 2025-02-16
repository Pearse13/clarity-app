import React, { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import config from '../config';

interface TransformResponse {
  result: string;
  error?: string;
}

const TextTransformer: React.FC = () => {
  const { getAccessTokenSilently } = useAuth0();
  const [text, setText] = useState('');
  const [transformType, setTransformType] = useState('simplify');
  const [level, setLevel] = useState(5);
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTransform = async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(`${config.apiUrl}/transform`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify({
          text,
          transform_type: transformType,
          level
        })
      });

      const data: TransformResponse = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data.result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Text Transformer</h1>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Text to Transform</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-32 p-2 border rounded-md"
            placeholder="Enter your text here..."
          />
        </div>
        
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">Transformation Type</label>
            <select
              value={transformType}
              onChange={(e) => setTransformType(e.target.value)}
              className="w-full p-2 border rounded-md"
            >
              <option value="simplify">Simplify</option>
              <option value="elaborate">Elaborate</option>
              <option value="formal">Formal</option>
              <option value="casual">Casual</option>
            </select>
          </div>
          
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">Level (1-10)</label>
            <input
              type="range"
              min="1"
              max="10"
              value={level}
              onChange={(e) => setLevel(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="text-center">{level}</div>
          </div>
        </div>

        <button
          onClick={handleTransform}
          disabled={loading || !text}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
        >
          {loading ? 'Transforming...' : 'Transform'}
        </button>

        {error && (
          <div className="p-4 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {result && !error && (
          <div className="mt-6">
            <h2 className="text-xl font-semibold mb-2">Result:</h2>
            <div className="p-4 bg-gray-100 rounded-md whitespace-pre-wrap">
              {result}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TextTransformer; 