// features/transactions/components/CancelTransactionModal.tsx
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Transaction } from '@/schemas/transaction.schema';
import { toast } from 'react-hot-toast';
import { useTransactions } from '@/features/transactions/hooks/useTransactions';

interface CancelTransactionModalProps {
  open: boolean;
  onClose: () => void;
  transaction: Transaction;
}

export default function CancelTransactionModal({
  open,
  onClose,
  transaction,
}: CancelTransactionModalProps) {
  const [cancellationReason, setCancellationReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const { updateTransactionStatus, isUpdatingStatus } = useTransactions(
    transaction.sender_organization_id || undefined,
  );

  const handleCancel = async () => {
    setIsCancelling(true);

    try {
      // Update transaction status to cancelled
      updateTransactionStatus({
        id: transaction.id,
        status: 'cancelled',
      });

      // In a real implementation, you might want to store the cancellation reason
      // You could update the transaction's metadata or add a separate field

      toast.success('Transaction cancelled successfully');
      onClose();
      setCancellationReason(''); // Reset form
    } catch (error) {
      console.error('Error cancelling transaction:', error);
      toast.error('Failed to cancel transaction. Please try again.');
    } finally {
      setIsCancelling(false);
    }
  };

  const formatAmount = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const canCancel = ['draft', 'scheduled', 'pending'].includes(transaction.status);
  const isLoading = isCancelling || isUpdatingStatus;

  if (!canCancel) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Cannot Cancel Transaction</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-600">
              This transaction cannot be cancelled in its current status: {transaction.status}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Only draft, scheduled, and pending transactions can be cancelled.
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Cancel Transaction
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning Message */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">
              <strong>Warning:</strong> This action cannot be undone. The transaction will be
              permanently cancelled.
            </p>
          </div>

          {/* Transaction Details */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">To:</span>
              <span className="text-sm font-semibold">{transaction.recipient_name}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Amount:</span>
              <span className="text-sm font-semibold">
                {formatAmount(transaction.amount, transaction.currency)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Status:</span>
              <span className="text-sm font-semibold capitalize">{transaction.status}</span>
            </div>

            {transaction.due_date && (
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">Due Date:</span>
                <span className="text-sm">
                  {new Date(transaction.due_date).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {/* Cancellation Reason */}
          <div className="space-y-2">
            <Label htmlFor="cancellation-reason">Reason for Cancellation (Optional)</Label>
            <Textarea
              id="cancellation-reason"
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="Please provide a reason for cancelling this transaction..."
              rows={3}
            />
          </div>

          {/* Confirmation Text */}
          <div className="text-sm text-gray-600">
            Are you sure you want to cancel this transaction? This action will:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Permanently mark the transaction as cancelled</li>
              <li>Prevent any further processing of this payment</li>
              <li>Notify the recipient that the transaction was cancelled</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} disabled={isLoading} className="flex-1">
              Keep Transaction
            </Button>

            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isLoading ? 'Cancelling...' : 'Cancel Transaction'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
