// components/common/Spinner.tsx
import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | string | number;
  color?: string;
  className?: string;
  breathingEffect?: boolean;
}

const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  color = '#3b82f6',
  className = '',
  breathingEffect = true,
}) => {
  // Convert named sizes to actual dimensions
  const sizeMap = {
    sm: '1.5rem',
    md: '2rem',
    lg: '3rem',
  };

  const actualSize = sizeMap[size as keyof typeof sizeMap] || size;

  return (
    <div className={`relative ${className}`} style={{ width: actualSize, height: actualSize }}>
      <svg
        className={`${breathingEffect ? 'animate-spin-breath' : 'animate-spin'} h-full w-full`}
        viewBox="0 0 100 100"
      >
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={breathingEffect ? '120 240' : '180 180'}
          strokeDashoffset="45"
          className={breathingEffect ? 'animate-dash-breathing' : ''}
        />
      </svg>
    </div>
  );
};

export default Spinner;
