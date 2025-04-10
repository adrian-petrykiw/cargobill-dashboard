export type BusinessWalletTransactionStatus =
  | 'draft'
  | 'open'
  | 'pending'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'scheduled'
  | 'confirmed';

export type BusinessWalletTransaction = {
  id: string;
  transactionId?: string;
  date: string;
  dueDate?: string;
  category: string;
  counterparty: string;
  notes?: string;
  paymentMethod: string;
  status: BusinessWalletTransactionStatus;
  amount: string;
  currency: string;
};
