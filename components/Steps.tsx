// components/Steps.tsx
import React from 'react';
import { cn } from '@/lib/utils';

interface StepProps {
  title: string;
  description?: string;
  status?: 'waiting' | 'in-progress' | 'completed';
  stepNumber?: number; // Made optional to fix type error
  isActive?: boolean;
  isLast?: boolean;
}

export const Step: React.FC<StepProps> = ({
  title,
  description,
  status = 'waiting',
  stepNumber,
  isActive = false,
  isLast = false,
}) => {
  return (
    <div className="relative flex-1">
      <div className="flex items-center">
        <div
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center border-2 relative z-10',
            {
              'bg-white border-gray-300 text-gray-500': !isActive && status === 'waiting',
              'bg-blue-50 border-blue-600 text-blue-600': isActive,
              'bg-green-50 border-green-600 text-green-600': status === 'completed',
            },
          )}
        >
          {status === 'completed' ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          ) : (
            <span className="text-sm font-medium">{stepNumber}</span>
          )}
        </div>
        {!isLast && (
          <div
            className={cn('flex-1 h-0.5 ml-2', {
              'bg-gray-200': !isActive && status !== 'completed',
              'bg-blue-600': isActive || status === 'completed',
            })}
          />
        )}
      </div>
      <div className="mt-2">
        <h3
          className={cn('text-sm font-medium', {
            'text-gray-500': !isActive && status === 'waiting',
            'text-blue-600': isActive,
            'text-green-600': status === 'completed',
          })}
        >
          {title}
        </h3>
        {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
      </div>
    </div>
  );
};

interface StepsProps {
  current: number;
  children: React.ReactNode;
}

export const Steps: React.FC<StepsProps> = ({ current, children }) => {
  const steps = React.Children.toArray(children);

  return (
    <div className="flex w-full">
      {steps.map((step, index) => {
        if (React.isValidElement<StepProps>(step)) {
          return React.cloneElement(step, {
            stepNumber: index + 1,
            isActive: index === current,
            isLast: index === steps.length - 1,
            status: index < current ? 'completed' : index === current ? 'in-progress' : 'waiting',
            ...(step.props as StepProps),
          });
        }
        return step;
      })}
    </div>
  );
};
