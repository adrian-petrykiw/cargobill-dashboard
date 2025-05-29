// features/transactions/components/PayTransactionModal.tsx
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, CreditCard, Building2, Wallet, PiggyBank } from 'lucide-react';
import { Transaction } from '@/schemas/transaction.schema';
import { toast } from 'react-hot-toast';
import { useTransactions } from '@/features/transactions/hooks/useTransactions';

interface PayTransactionModalProps {
  open: boolean;
  onClose: () => void;
  transaction: Transaction;
}

interface PaymentMethod {
  id: string;
  type: 'wallet' | 'account' | 'card';
  name: string;
  displayName: string;
  icon: React.ReactNode;
}

// Updated payment methods (removed treasury_wallet and yield_wallet)
const availablePaymentMethods: PaymentMethod[] = [
  {
    id: 'operational_wallet',
    type: 'wallet',
    name: 'Operational Wallet',
    displayName: 'Operational Wallet (Primary)',
    icon: <Wallet className="h-4 w-4" />,
  },
  {
    id: 'cashback',
    type: 'wallet',
    name: 'Cashback',
    displayName: 'Cashback Wallet',
    icon: <PiggyBank className="h-4 w-4" />,
  },
  {
    id: 'fbo_account',
    type: 'account',
    name: 'FBO Account',
    displayName: 'FBO Account',
    icon: <Building2 className="h-4 w-4" />,
  },
  {
    id: 'virtual_card',
    type: 'card',
    name: 'Virtual Card',
    displayName: 'Virtual Card',
    icon: <CreditCard className="h-4 w-4" />,
  },
  {
    id: 'physical_card',
    type: 'card',
    name: 'Physical Card',
    displayName: 'Physical Card',
    icon: <CreditCard className="h-4 w-4" />,
  },
  {
    id: 'external_card',
    type: 'card',
    name: 'External Card',
    displayName: 'External Card',
    icon: <CreditCard className="h-4 w-4" />,
  },
  {
    id: 'external_bank_account',
    type: 'account',
    name: 'External Bank Account',
    displayName: 'External Bank Account',
    icon: <Building2 className="h-4 w-4" />,
  },
];

export default function PayTransactionModal({
  open,
  onClose,
  transaction,
}: PayTransactionModalProps) {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const { updateTransaction, isUpdatingTransaction } = useTransactions(
    transaction.sender_organization_id || undefined,
  );

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setSelectedPaymentMethod('');
    }
  }, [open]);

  const handlePay = async () => {
    if (!selectedPaymentMethod) {
      toast.error('Please select a payment method');
      return;
    }

    setIsProcessing(true);

    try {
      // Update the transaction with the selected payment method and mark as completed
      updateTransaction({
        id: transaction.id,
        updateData: {
          payment_method: selectedPaymentMethod,
          metadata: {
            ...((transaction.metadata as any) || {}),
            payment_processed_at: new Date().toISOString(),
            payment_method_selected: selectedPaymentMethod,
          },
        },
      });

      toast.success('Payment processed successfully');
      onClose();
    } catch (error) {
      console.error('Payment processing error:', error);
      toast.error('Failed to process payment. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatAmount = (amount: number, currency: string = 'USDC') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency === 'USDC' ? 'USD' : currency,
    }).format(amount);
  };

  const isLoading = isProcessing || isUpdatingTransaction;

  // Filter payment methods that make sense for paying open transactions
  const paymentMethodsForPaying = availablePaymentMethods.filter((method) =>
    // For open transactions, typically wallets and accounts are used for payment
    ['operational_wallet', 'fbo_account', 'external_bank_account'].includes(method.id),
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Pay Transaction</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Transaction Details */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">To:</span>
              <span className="text-sm font-semibold">{transaction.recipient_name}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Amount:</span>
              <span className="text-lg font-bold text-gray-900">
                {formatAmount(transaction.amount, transaction.currency)}
              </span>
            </div>

            {transaction.due_date && (
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">Due Date:</span>
                <span className="text-sm">
                  {new Date(transaction.due_date).toLocaleDateString()}
                </span>
              </div>
            )}

            {transaction.invoices &&
              Array.isArray(transaction.invoices) &&
              transaction.invoices.length > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Invoices:</span>
                  <span className="text-sm">
                    {(transaction.invoices as any[]).map((inv: any) => inv.number).join(', ')}
                  </span>
                </div>
              )}
          </div>

          {/* Payment Method Selection */}
          <div className="space-y-2">
            <Label htmlFor="payment-method">Payment Method</Label>
            <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                {paymentMethodsForPaying.map((method) => (
                  <SelectItem key={method.id} value={method.id}>
                    <div className="flex items-center gap-2">
                      {method.icon}
                      <span>{method.displayName}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment Information */}
          {selectedPaymentMethod && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <p>
                This payment will be processed using your{' '}
                {paymentMethodsForPaying.find((m) => m.id === selectedPaymentMethod)?.displayName}.
                The transaction will be marked as completed once processed.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} disabled={isLoading} className="flex-1">
              Cancel
            </Button>

            <Button
              onClick={handlePay}
              disabled={!selectedPaymentMethod || isLoading}
              className="flex-1"
            >
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isLoading
                ? 'Processing...'
                : `Pay ${formatAmount(transaction.amount, transaction.currency)}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
