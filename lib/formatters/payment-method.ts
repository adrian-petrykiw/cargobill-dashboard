// lib/formatters/payment-method.ts
export function formatPaymentMethod(method: string): string {
  switch (method) {
    case 'account_credit':
      return 'Available Credit';
    case 'ach':
      return 'ACH Transfer';
    case 'wire':
      return 'Wire Transfer';
    case 'credit_card':
      return 'Credit Card';
    case 'debit_card':
      return 'Debit Card';
    default:
      return method.charAt(0).toUpperCase() + method.slice(1).replace(/_/g, ' ');
  }
}
