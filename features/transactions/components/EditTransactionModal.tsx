// features/transactions/components/EditTransactionModal.tsx
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, X, Upload, Wallet, Building2, CreditCard, PiggyBank } from 'lucide-react';
import { Transaction } from '@/schemas/transaction.schema';
import { toast } from 'react-hot-toast';
import { useTransactions } from '@/features/transactions/hooks/useTransactions';

interface EditTransactionModalProps {
  open: boolean;
  onClose: () => void;
  transaction: Transaction;
}

interface InvoiceItem {
  number: string;
  amount: number;
}

interface EditTransactionData {
  amount: number;
  invoices: InvoiceItem[];
  memo?: string;
  due_date?: string;
  payment_method?: string;
}

// Updated payment method options (removed treasury_wallet and yield_wallet)
const paymentMethodOptions = [
  {
    value: 'operational_wallet',
    label: 'Operational Wallet',
    icon: <Wallet className="h-4 w-4" />,
  },
  {
    value: 'cashback',
    label: 'Cashback Wallet',
    icon: <PiggyBank className="h-4 w-4" />,
  },
  {
    value: 'fbo_account',
    label: 'FBO Account',
    icon: <Building2 className="h-4 w-4" />,
  },
  {
    value: 'virtual_card',
    label: 'Virtual Card',
    icon: <CreditCard className="h-4 w-4" />,
  },
  {
    value: 'physical_card',
    label: 'Physical Card',
    icon: <CreditCard className="h-4 w-4" />,
  },
  {
    value: 'external_card',
    label: 'External Card',
    icon: <CreditCard className="h-4 w-4" />,
  },
  {
    value: 'external_bank_account',
    label: 'External Bank Account',
    icon: <Building2 className="h-4 w-4" />,
  },
];

export default function EditTransactionModal({
  open,
  onClose,
  transaction,
}: EditTransactionModalProps) {
  const [formData, setFormData] = useState<EditTransactionData>({
    amount: 0,
    invoices: [],
    memo: '',
    due_date: '',
    payment_method: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const { updateTransaction, isUpdatingTransaction } = useTransactions(
    transaction.sender_organization_id || undefined,
  );

  // Initialize form data when modal opens
  useEffect(() => {
    if (open && transaction) {
      const invoices = Array.isArray(transaction.invoices)
        ? (transaction.invoices as any[]).map((inv: any) => ({
            number: inv.number || '',
            amount: inv.amount || 0,
          }))
        : [{ number: '', amount: transaction.amount }];

      setFormData({
        amount: transaction.amount,
        invoices: invoices.length > 0 ? invoices : [{ number: '', amount: transaction.amount }],
        memo: transaction.memo || '',
        due_date: transaction.due_date ? transaction.due_date.split('T')[0] : '',
        payment_method: transaction.payment_method || '',
      });
      setUploadedFiles([]);
    }
  }, [open, transaction]);

  const handleAmountChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    setFormData((prev) => ({ ...prev, amount: numValue }));
  };

  const handleInvoiceChange = (index: number, field: 'number' | 'amount', value: string) => {
    setFormData((prev) => ({
      ...prev,
      invoices: prev.invoices.map((invoice, i) =>
        i === index
          ? { ...invoice, [field]: field === 'amount' ? parseFloat(value) || 0 : value }
          : invoice,
      ),
    }));
  };

  const addInvoice = () => {
    setFormData((prev) => ({
      ...prev,
      invoices: [...prev.invoices, { number: '', amount: 0 }],
    }));
  };

  const removeInvoice = (index: number) => {
    if (formData.invoices.length > 1) {
      setFormData((prev) => ({
        ...prev,
        invoices: prev.invoices.filter((_, i) => i !== index),
      }));
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setUploadedFiles((prev) => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const validateForm = (): boolean => {
    if (formData.amount <= 0) {
      toast.error('Amount must be greater than 0');
      return false;
    }

    if (formData.invoices.some((inv) => !inv.number.trim())) {
      toast.error('All invoice numbers are required');
      return false;
    }

    const totalInvoiceAmount = formData.invoices.reduce((sum, inv) => sum + inv.amount, 0);
    if (Math.abs(totalInvoiceAmount - formData.amount) > 0.01) {
      toast.error('Total invoice amounts must equal the transaction amount');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      // Update transaction via the hook - Fixed the type issue here
      updateTransaction({
        id: transaction.id,
        updateData: {
          amount: formData.amount,
          invoices: formData.invoices,
          memo: formData.memo || undefined, // Convert empty string to undefined
          due_date: formData.due_date || undefined, // Convert empty string to undefined
          payment_method: formData.payment_method || undefined, // Fix: Convert null to undefined and handle empty string
          // Add metadata for files if any were uploaded
          metadata: {
            ...((transaction.metadata as any) || {}),
            files_uploaded: uploadedFiles.length,
            files_updated_at: uploadedFiles.length > 0 ? new Date().toISOString() : undefined,
          },
        },
      });

      toast.success('Transaction updated successfully');
      onClose();
    } catch (error) {
      console.error('Error updating transaction:', error);
      toast.error('Failed to update transaction. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canEdit = ['draft', 'scheduled'].includes(transaction.status);

  if (!canEdit) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Cannot Edit Transaction</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-600">
              This transaction cannot be edited in its current status: {transaction.status}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Only draft and scheduled transactions can be modified.
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const isLoading = isSubmitting || isUpdatingTransaction;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Transaction</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Transaction Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">To:</span>
              <span className="text-sm font-semibold">{transaction.recipient_name}</span>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Total Amount ({transaction.currency})</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label htmlFor="payment-method">Payment Method</Label>
            <Select
              value={formData.payment_method || ''}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, payment_method: value }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                {paymentMethodOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      {option.icon}
                      <span>{option.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label htmlFor="due-date">Due Date (Optional)</Label>
            <Input
              id="due-date"
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData((prev) => ({ ...prev, due_date: e.target.value }))}
            />
          </div>

          {/* Invoices */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Invoices</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addInvoice}
                className="h-8"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Invoice
              </Button>
            </div>

            <div className="space-y-2">
              {formData.invoices.map((invoice, index) => (
                <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
                  <div className="flex-1">
                    <Input
                      placeholder="Invoice number"
                      value={invoice.number}
                      onChange={(e) => handleInvoiceChange(index, 'number', e.target.value)}
                    />
                  </div>
                  <div className="w-32">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Amount"
                      value={invoice.amount}
                      onChange={(e) => handleInvoiceChange(index, 'amount', e.target.value)}
                    />
                  </div>
                  {formData.invoices.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeInvoice(index)}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>Attachments</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex items-center justify-center gap-2 text-gray-600 hover:text-gray-800"
              >
                <Upload className="h-4 w-4" />
                <span>Click to upload files</span>
              </label>
            </div>

            {uploadedFiles.length > 0 && (
              <div className="space-y-1">
                {uploadedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded"
                  >
                    <span className="text-sm text-gray-700">{file.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="h-6 w-6 p-0 text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Memo */}
          <div className="space-y-2">
            <Label htmlFor="memo">Notes/Memo (Optional)</Label>
            <Textarea
              id="memo"
              value={formData.memo}
              onChange={(e) => setFormData((prev) => ({ ...prev, memo: e.target.value }))}
              placeholder="Add a note for this transaction..."
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} disabled={isLoading} className="flex-1">
              Cancel
            </Button>

            <Button onClick={handleSubmit} disabled={isLoading} className="flex-1">
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isLoading ? 'Updating...' : 'Update Transaction'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
