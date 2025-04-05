// components/Spinner.tsx
import React from 'react';

interface SpinnerProps {
  size?: string | number;
  color?: string;
  className?: string;
}

const Spinner: React.FC<SpinnerProps> = ({
  size = '2rem', // default size
  color = '#3b82f6', // default blue color
  className = '',
}) => {
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg className="animate-spin h-full w-full" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray="180 180"
          strokeDashoffset="45"
        />
      </svg>
    </div>
  );
};

export default Spinner;
