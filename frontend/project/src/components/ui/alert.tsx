import React from 'react';
import { clsx } from 'clsx';

interface AlertProps {
  type?: 'info' | 'success' | 'warning' | 'error';
  children: React.ReactNode;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({ 
  type = 'info', 
  children, 
  className 
}) => {
  const baseStyles = 'p-4 rounded-lg border';
  const typeStyles = {
    info: 'bg-blue-50 border-blue-200 text-blue-700',
    success: 'bg-green-50 border-green-200 text-green-700',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    error: 'bg-red-50 border-red-200 text-red-700'
  };

  return (
    <div className={clsx(baseStyles, typeStyles[type], className)}>
      {children}
    </div>
  );
};

export default Alert; 