// features/transactions/components/TransactionStatus.tsx
import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface TransactionStatusProps {
  onDone: () => Promise<void>; // Changed to Promise to handle async operations
  currentStatus: 'encrypting' | 'creating' | 'confirming' | 'confirmed';
}

export function TransactionStatus({ onDone, currentStatus }: TransactionStatusProps) {
  const [showDone, setShowDone] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    if (currentStatus === 'confirmed') {
      setShowDone(true);
    }
  }, [currentStatus]);

  const handleDone = async () => {
    setIsCompleting(true);
    try {
      await onDone();
      // The component will unmount after onDone completes, so we don't need to reset state
    } catch (error) {
      console.error('Error completing transaction cleanup:', error);
      // Reset loading state if there's an error
      setIsCompleting(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-4">
        <StatusItem
          title="Encrypting Business Data"
          isActive={currentStatus === 'encrypting'}
          isDone={currentStatus !== 'encrypting'}
        />
        <StatusItem
          title="Creating Transaction"
          isActive={currentStatus === 'creating'}
          isDone={currentStatus !== 'creating' && currentStatus !== 'encrypting'}
        />
        <StatusItem
          title="Confirming Transaction"
          isActive={currentStatus === 'confirming'}
          isDone={currentStatus === 'confirmed'}
        />
        {showDone && (
          <Card className="p-4 bg-green-50 border-green-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Check className="h-5 w-5 text-green-500" />
                <span className="text-green-600 font-medium">Payment Completed</span>
              </div>
              <Button
                onClick={handleDone}
                variant="outline"
                disabled={isCompleting}
                className="px-4 py-2 text-green-600 border-green-200 hover:bg-green-100 disabled:opacity-50"
              >
                {isCompleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-0 animate-spin" />
                    {/* Finalizing */}
                  </>
                ) : (
                  'Done'
                )}
              </Button>
            </div>
            {/* {isCompleting ||
              (true && (
                <div className="mt-2 text-xs text-green-600">
                  Updating records and refreshing data...
                </div>
              ))} */}
          </Card>
        )}
      </div>
    </div>
  );
}

function StatusItem({
  title,
  isActive,
  isDone,
}: {
  title: string;
  isActive: boolean;
  isDone: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span
          className={`${
            isDone ? 'text-gray-500' : isActive ? 'text-blue-600 font-medium' : 'text-gray-400'
          }`}
        >
          {title}
        </span>
        {isActive ? (
          <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
        ) : isDone ? (
          <Check className="h-5 w-5 text-green-500" />
        ) : null}
      </div>
    </Card>
  );
}
