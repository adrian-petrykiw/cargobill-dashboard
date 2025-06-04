// schemas/vendor.schema.ts
import { z } from 'zod';
import { TokenType } from '@/types/token';

// Define the invoice schema with Zod for validation
export const invoiceSchema = z.object({
  number: z.string().min(1, 'Invoice number is required'),
  amount: z.number().positive('Amount must be positive'),
  files: z.array(z.instanceof(File)).optional(),
});

// Use this single type definition derived from the schema
export type Invoice = z.infer<typeof invoiceSchema>;

export const createVendorFormSchema = (
  customFields: Array<{
    key: string;
    name: string;
    type: string;
    required: boolean;
    defaultValue?: any;
  }> = [],
) => {
  const baseSchema = z.object({
    vendor: z.string().min(1, 'Vendor is required'),
    invoices: z.array(invoiceSchema).min(1, 'At least one invoice is required'),
    tokenType: z.enum(['USDC', 'USDT', 'EURC']).default('USDC'),
    paymentDate: z.date().default(() => new Date()),
    additionalInfo: z.string().optional(),
  });

  if (!customFields || customFields.length === 0) {
    return baseSchema;
  }

  const additionalFields: Record<string, z.ZodTypeAny> = {};

  customFields.forEach((field) => {
    if (field.type === 'number') {
      additionalFields[field.key] = field.required
        ? z.number({ required_error: `${field.name} is required` })
        : z.number().optional();
    } else {
      additionalFields[field.key] = field.required
        ? z.string().min(1, `${field.name} is required`)
        : z.string().optional();
    }
  });

  return baseSchema.extend(additionalFields);
};

export type VendorFormValues = z.infer<ReturnType<typeof createVendorFormSchema>>;

export type EnrichedVendorFormValues = VendorFormValues & {
  totalAmount: number;
  sender: string;
  receiverDetails?: any;
};

// Define the payment form schema with standardized payment method values
// Based on transactionMappers.ts mapping to ensure consistency
export const paymentDetailsSchema = z
  .object({
    // Frontend payment method values that map to database values via transactionMappers.ts
    // account_credit -> operational_wallet (business wallet)
    // ach/wire -> external_bank_account
    // credit_card/debit_card -> external_card
    paymentMethod: z.enum(['account_credit', 'ach', 'wire', 'credit_card', 'debit_card']),
    tokenType: z.enum(['USDC', 'USDT', 'EURC']),

    // Optional fields for ACH
    accountName: z.string().optional(),
    routingNumber: z.string().optional(),
    accountNumber: z.string().optional(),
    accountType: z.enum(['checking', 'savings']).optional(),

    // Optional fields for wire
    bankName: z.string().optional(),
    swiftCode: z.string().optional(),

    // Optional fields for credit/debit card
    cardNumber: z.string().optional(),
    expiryDate: z.string().optional(),
    cvv: z.string().optional(),
    billingName: z.string().optional(),
    billingAddress: z.string().optional(),
    billingCity: z.string().optional(),
    billingState: z.string().optional(),
    billingZip: z.string().optional(),
  })
  .refine(
    (data) => {
      // Validate ACH fields
      if (data.paymentMethod === 'ach') {
        return (
          !!data.accountName && !!data.routingNumber && !!data.accountNumber && !!data.accountType
        );
      }
      // Validate wire fields
      if (data.paymentMethod === 'wire') {
        return !!data.bankName && !!data.accountNumber && !!data.routingNumber;
      }
      // Validate card fields
      if (data.paymentMethod === 'credit_card' || data.paymentMethod === 'debit_card') {
        return (
          !!data.cardNumber &&
          !!data.expiryDate &&
          !!data.cvv &&
          !!data.billingName &&
          !!data.billingAddress &&
          !!data.billingCity &&
          !!data.billingState &&
          !!data.billingZip
        );
      }
      return true;
    },
    {
      message: 'Please fill all required fields for the selected payment method',
      path: ['paymentMethod'],
    },
  );

export type PaymentDetailsFormValues = z.infer<typeof paymentDetailsSchema>;

// Payment method mapping reference (for documentation)
// Frontend -> Database (via transactionMappers.ts)
// account_credit -> operational_wallet (business wallet)
// ach -> external_bank_account
// wire -> external_bank_account
// credit_card -> external_card
// debit_card -> external_card
