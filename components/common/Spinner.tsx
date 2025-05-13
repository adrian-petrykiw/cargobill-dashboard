// components/common/Spinner.tsx
import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | string | number;
  color?: string;
  className?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ size = 'md', color = '#233CFF', className = '' }) => {
  // Convert named sizes to actual dimensions
  const sizeMap = {
    sm: '1.5rem',
    md: '2.5rem',
    lg: '4rem',
  };

  const actualSize =
    typeof size === 'string' && size in sizeMap ? sizeMap[size as keyof typeof sizeMap] : size;

  return (
    <div className={`relative ${className}`} style={{ width: actualSize, height: actualSize }}>
      <svg className="rotating-spinner" viewBox="0 0 50 50">
        <circle
          className="spinner-path"
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="butt"
          style={{
            transformOrigin: 'center',
          }}
        />
      </svg>
    </div>
  );
};

export default Spinner;
