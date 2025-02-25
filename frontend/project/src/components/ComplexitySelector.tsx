// import React from 'react';
import { SIMPLIFY_LEVELS, SOPHISTICATE_LEVELS } from '../utils/constants';

interface ComplexitySelectorProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  isSimplifying: boolean;
}

export function ComplexitySelector({ 
  value, 
  onChange, 
  label,
  isSimplifying 
}: ComplexitySelectorProps) {
  const levels = isSimplifying ? SIMPLIFY_LEVELS : SOPHISTICATE_LEVELS;

  return (
    <div className="space-y-2">
      <label className="block text-[13px] font-medium text-gray-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full p-2 text-[15px] bg-gray-50/50 border border-gray-200/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        {Object.entries(levels).map(([level, description]) => (
          <option key={level} value={level}>
            Level {level}: {description}
          </option>
        ))}
      </select>
    </div>
  );
}