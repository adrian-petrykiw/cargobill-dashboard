// schemas/payment-method.schema.ts
import { z } from 'zod';

// Credit card schema with billing address
export const creditCardSchema = z.object({
  cardholderName: z.string().min(1, 'Cardholder name is required'),
  cardNumber: z.string().min(13, 'Invalid card number').max(19),
  expiryDate: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Expiry date must be in MM/YY format'),
  cvv: z.string().regex(/^\d{3,4}$/, 'CVV must be 3 or 4 digits'),
  billingZip: z.string().optional(),
  billingCountry: z.string().optional(),
});

export type CreditCardFormData = z.infer<typeof creditCardSchema>;

// Bank account form data will be dynamically generated based on country
export type BankAccountFormData = Record<string, any>;

// Interface for payment methods - standardized with transactionMappers.ts
export interface PaymentMethod {
  id: string;
  type:
    | 'operational_wallet'
    | 'external_bank_account'
    | 'external_card'
    | 'fbo_account'
    | 'virtual_card'
    | 'physical_card'
    | 'cashback';
  [key: string]: any;
}

// Frontend payment method types that map to database values
export type FrontendPaymentMethod =
  | 'account_credit'
  | 'ach'
  | 'wire'
  | 'credit_card'
  | 'debit_card';

// Database payment method types (from transactionMappers.ts)
export type DatabasePaymentMethod =
  | 'operational_wallet'
  | 'cashback'
  | 'fbo_account'
  | 'virtual_card'
  | 'physical_card'
  | 'external_card'
  | 'external_bank_account';

// Interface for banking country option
export interface BankingCountryOption {
  value: string;
  label: string;
  code: string;
}

// Interface for Zynk entity account object with comprehensive support
export interface EntityAccountParams {
  jurisdictionID: string;
  account?: {
    [key: string]: any;
  } & {
    accountNumber?: string;
    accountHolderName: string;
    bankName: string;
    bankCountry: string;
    bankRoutingNumber?: string;
    accountType?: string;
    // International banking fields
    bankSwiftCode?: string;
    bankIban?: string;
    institutionNumber?: string; // Canada
    transitNumber?: string; // Canada
    bankCode?: string; // Asia
    branchCode?: string; // Asia
    ifscCode?: string; // India
    sortCode?: string; // UK
    bsb?: string; // Australia
  };
  wallet?: {
    walletAddress: string;
    [key: string]: any;
  };
}

// Helper function to map between our fields and Zynk fields with enhanced international support
export function mapToZynkAccountFormat(bankData: any, countryCode: string): EntityAccountParams {
  // Start with basic account data with required fields
  const accountData: EntityAccountParams['account'] = {
    accountHolderName: bankData.accountHolderName || bankData.accountName || '',
    bankName: bankData.bankName || '',
    bankCountry: countryCode,
    accountNumber: bankData.accountNumber || '',
  };

  // Add routing number if present (US format)
  if (bankData.routingNumber) {
    accountData.bankRoutingNumber = bankData.routingNumber;
  }

  // Add account type if present
  if (bankData.accountType) {
    accountData.accountType = bankData.accountType;
  }

  // Add SWIFT/BIC code if present (international)
  if (bankData.swift || bankData.swiftCode) {
    accountData.bankSwiftCode = bankData.swift || bankData.swiftCode;
  }

  // Add IBAN if present (Europe)
  if (bankData.iban) {
    accountData.bankIban = bankData.iban;
  }

  // Add institution number if present (Canada)
  if (bankData.institutionNumber) {
    accountData.institutionNumber = bankData.institutionNumber;
  }

  // Add transit number if present (Canada)
  if (bankData.transitNumber) {
    accountData.transitNumber = bankData.transitNumber;
  }

  // Add sort code if present (UK)
  if (bankData.sortCode) {
    accountData.sortCode = bankData.sortCode;
  }

  // Add BSB if present (Australia)
  if (bankData.bsb) {
    accountData.bsb = bankData.bsb;
  }

  // Map bank code and branch code for Asian countries
  if (bankData.bankCode) {
    accountData.bankCode = bankData.bankCode;
  }

  if (bankData.branchCode) {
    accountData.branchCode = bankData.branchCode;
  }

  // IFSC for India
  if (bankData.ifscCode) {
    accountData.ifscCode = bankData.ifscCode;
  }

  return {
    jurisdictionID: `jurisdiction_${countryCode.toLowerCase()}`,
    account: accountData,
  };
}

// Payment method display formatting based on transactionMappers.ts
export function formatPaymentMethodDisplay(
  paymentMethod: DatabasePaymentMethod | FrontendPaymentMethod,
): string {
  const paymentMethodMap: Record<string, string> = {
    // Database values (from transactionMappers.ts)
    operational_wallet: 'Business Wallet',
    cashback: 'Cashback Wallet',
    fbo_account: 'FBO Account',
    virtual_card: 'Virtual Card',
    physical_card: 'Physical Card',
    external_card: 'External Card',
    external_bank_account: 'External Bank Account',
    // Frontend values
    account_credit: 'Business Wallet',
    ach: 'ACH Transfer',
    wire: 'Wire Transfer',
    credit_card: 'Credit Card',
    debit_card: 'Debit Card',
  };

  return paymentMethodMap[paymentMethod] || paymentMethod;
}

// Check if payment method requires onramp (not business wallet)
export function requiresOnramp(
  paymentMethod: FrontendPaymentMethod | DatabasePaymentMethod,
): boolean {
  const businessWalletMethods = ['account_credit', 'operational_wallet'];
  return !businessWalletMethods.includes(paymentMethod);
}

// Map frontend payment method to database payment method (from transactionMappers.ts)
export function mapPaymentMethodToDatabase(
  frontendPaymentMethod: FrontendPaymentMethod,
): DatabasePaymentMethod {
  const paymentMethodMap: Record<FrontendPaymentMethod, DatabasePaymentMethod> = {
    account_credit: 'operational_wallet',
    ach: 'external_bank_account',
    wire: 'external_bank_account',
    credit_card: 'external_card',
    debit_card: 'external_card',
  };

  return paymentMethodMap[frontendPaymentMethod];
}
