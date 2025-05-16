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

// Interface for payment methods
export interface PaymentMethod {
  id: string;
  [key: string]: any;
}

// Interface for banking country option
export interface BankingCountryOption {
  value: string;
  label: string;
  code: string;
}

// Interface for Zynk entity account object
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
  };
  wallet?: {
    walletAddress: string;
    [key: string]: any;
  };
}

// Helper function to map between our fields and Zynk fields
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

  // Add swift/bic code if present
  if (bankData.swift) {
    accountData.bankSwiftCode = bankData.swift;
  }

  // Add IBAN if present
  if (bankData.iban) {
    accountData.bankIban = bankData.iban;
  }

  // Add institution number if present (Canadian)
  if (bankData.institutionNumber) {
    accountData.institutionNumber = bankData.institutionNumber;
  }

  // Add transit number if present (Canadian)
  if (bankData.transitNumber) {
    accountData.transitNumber = bankData.transitNumber;
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
