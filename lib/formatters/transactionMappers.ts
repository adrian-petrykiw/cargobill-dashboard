// lib/formatters/transactionMappers.ts
import { Transaction } from '@/schemas/transaction.schema';
import {
  BusinessWalletTransaction,
  BusinessWalletTransactionStatus,
} from '@/types/businessWalletTransaction';

// Helper function to format payment method for display (removed yield_wallet and treasury_wallet)
export function formatPaymentMethodForDisplay(paymentMethod: string | null | undefined): string {
  if (!paymentMethod) return 'Unknown';

  const paymentMethodMap: Record<string, string> = {
    operational_wallet: 'Business Wallet',
    cashback: 'Cashback Wallet',
    fbo_account: 'FBO Account',
    virtual_card: 'Virtual Card',
    physical_card: 'Physical Card',
    external_card: 'External Card',
    external_bank_account: 'External Bank Account',
  };

  return paymentMethodMap[paymentMethod] || paymentMethod;
}

// Helper function to map transaction_type to category
export function mapTransactionTypeToCategory(transactionType: string): string {
  const categoryMap: Record<string, string> = {
    payment: 'Payment',
    request: 'Payment Request',
    deposit: 'Deposit',
    withdrawal: 'Withdrawal',
    transfer: 'Transfer',
    fee: 'Fee',
  };

  return categoryMap[transactionType] || 'Other';
}

// Helper function to map database status to BusinessWallet status (removed approved/rejected)
export function mapDatabaseStatusToBusinessWallet(
  status: string,
  transactionType: string,
): BusinessWalletTransactionStatus {
  // Handle special case for payment requests
  if (transactionType === 'request' && (status === 'pending' || status === 'requested')) {
    return 'open';
  }

  // Direct mappings for statuses that exist in both
  const statusMap: Record<string, BusinessWalletTransactionStatus> = {
    draft: 'draft',
    pending: 'pending',
    completed: 'completed',
    failed: 'failed',
    cancelled: 'cancelled',
    confirmed: 'confirmed',
    requested: 'open', // Map requested to open
  };

  return statusMap[status] || 'pending';
}

export function mapTransactionToBusinessWallet(
  transaction: Transaction,
  currentOrgId: string,
): BusinessWalletTransaction {
  // Determine if this is sent or received transaction
  const isSent = transaction.sender_organization_id === currentOrgId;

  // Format amount with commas
  const formattedAmount = transaction.amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Format dates
  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '-';
    }
  };

  // Determine counterparty name
  const counterparty = isSent
    ? transaction.recipient_name || 'Unknown Recipient'
    : transaction.sender_name || 'Unknown Sender';

  // Map status using the helper function
  const mappedStatus = mapDatabaseStatusToBusinessWallet(
    transaction.status,
    transaction.transaction_type,
  );

  // Map transaction type to category
  const category = mapTransactionTypeToCategory(transaction.transaction_type);

  // Use the payment_method field from the transaction, with fallback logic
  let paymentMethod = formatPaymentMethodForDisplay(transaction.payment_method);

  // Fallback: check metadata for payment method if not set on transaction
  if (
    !transaction.payment_method &&
    transaction.metadata &&
    typeof transaction.metadata === 'object'
  ) {
    const metadata = transaction.metadata as any;
    if (metadata.payment_method) {
      paymentMethod = formatPaymentMethodForDisplay(metadata.payment_method);
    } else if (metadata.restricted_payment_methods?.length > 0) {
      paymentMethod = formatPaymentMethodForDisplay(metadata.restricted_payment_methods[0]);
    }
  }

  // Extract notes from memo field
  const notes = transaction.memo || undefined;

  return {
    id: transaction.id,
    transactionId: transaction.signature || undefined,
    date: formatDate(transaction.created_at),
    dueDate: transaction.due_date ? formatDate(transaction.due_date) : undefined,
    category,
    counterparty,
    notes,
    paymentMethod,
    status: mappedStatus,
    amount: formattedAmount,
    currency: transaction.currency || 'USDC',
  };
}

// Helper function to map frontend payment method selections to database payment_method values (removed yield_wallet and treasury_wallet)
export function mapPaymentMethodToDbValue(frontendPaymentMethod: string): string {
  const paymentMethodMap: Record<string, string> = {
    account_credit: 'operational_wallet',
    ach: 'external_bank_account',
    wire: 'external_bank_account',
    credit_card: 'external_card',
    debit_card: 'external_card',
    // Direct mappings for cases where frontend uses the same values
    operational_wallet: 'operational_wallet',
    cashback: 'cashback',
    fbo_account: 'fbo_account',
    virtual_card: 'virtual_card',
    physical_card: 'physical_card',
    external_card: 'external_card',
    external_bank_account: 'external_bank_account',
  };

  return paymentMethodMap[frontendPaymentMethod] || frontendPaymentMethod;
}
