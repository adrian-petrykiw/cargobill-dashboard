// features/transactions/components/TransactionStatus.tsx
import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface TransactionStatusProps {
  onDone: () => void;
  currentStatus: 'encrypting' | 'creating' | 'confirming' | 'confirmed';
}

export function TransactionStatus({ onDone, currentStatus }: TransactionStatusProps) {
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    if (currentStatus === 'confirmed') {
      setShowDone(true);
    }
  }, [currentStatus]);

  const handleDone = () => {
    setShowDone(false);
    onDone();
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
                <span className="text-green-700 font-medium">Payment Confirmed!</span>
              </div>
              <Button
                onClick={handleDone}
                variant="outline"
                className="px-4 py-2 text-green-600 border-green-200 hover:bg-green-100"
              >
                Done
              </Button>
            </div>
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
