// schemas/transaction.schema.ts
import { z } from 'zod';
import { jsonSchema } from './common';

// Define the enums based on your actual database constraints
const transactionStatusEnum = z.enum([
  'draft',
  'pending',
  'completed',
  'failed',
  'cancelled',
  'confirmed',
  'requested',
]);

const transactionTypeEnum = z.enum([
  'payment',
  'request',
  'deposit',
  'withdrawal',
  'transfer',
  'fee',
]);

// Updated payment methods (removed yield_wallet and treasury_wallet as per your updates)
const paymentMethodEnum = z.enum([
  'operational_wallet',
  'cashback',
  'fbo_account',
  'virtual_card',
  'physical_card',
  'external_card',
  'external_bank_account',
]);

export const transactionSchema = z.object({
  id: z.string().uuid(),
  amount: z.number().positive(),
  created_at: z.string(),
  created_by: z.string(),
  fee_amount: z.number().default(0),
  invoices: jsonSchema,
  recipient_name: z.string(),
  sender_name: z.string(),
  status: z.string(), // Keep as string to handle database values properly
  token_mint: z.string(),
  transaction_type: z.string(), // Keep as string to handle database values properly
  payment_method: z.string().nullable().optional(), // Keep as string to handle database values properly
  completed_at: z.string().nullable().optional(),
  currency: z.string().default('USDC'),
  due_date: z.string().nullable().optional(),
  memo: z.string().nullable().optional(),
  metadata: jsonSchema.nullable().optional(),
  proof_data: jsonSchema,
  recipient_organization_id: z.string().uuid().nullable().optional(),
  sender_organization_id: z.string().uuid().nullable().optional(),
  signature: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  updated_by: z.string().nullable().optional(),
});

export type Transaction = z.infer<typeof transactionSchema>;

export const createTransactionSchema = transactionSchema
  .omit({
    id: true,
    completed_at: true,
    updated_at: true,
    updated_by: true,
    created_at: true,
  })
  .extend({
    created_at: z.string().optional(),
    status: transactionStatusEnum.default('pending'),
    transaction_type: transactionTypeEnum,
    payment_method: paymentMethodEnum.optional(),
    // Make sender_organization_id required for create operations
    sender_organization_id: z.string().uuid(),
  });

export type CreateTransactionRequest = z.infer<typeof createTransactionSchema>;

export const updateTransactionSchema = transactionSchema
  .omit({
    created_at: true,
    created_by: true,
  })
  .partial()
  .required({ id: true })
  .extend({
    // Allow enum values for updates
    status: transactionStatusEnum.optional(),
    transaction_type: transactionTypeEnum.optional(),
    payment_method: paymentMethodEnum.nullable().optional(),
  });

export type UpdateTransactionRequest = z.infer<typeof updateTransactionSchema>;

// Schema for validating proof data structure
export const proofDataSchema = z.object({
  encryption_keys: z.record(z.string()),
  memo_hashes: z.record(z.string()),
  file_hashes: z.record(z.array(z.string())).optional(),
  comprehensive_encrypted_data: z.record(z.string()).optional(),
  essential_data_used: z.record(z.any()).optional(),
  // Legacy support for older transaction formats
  payment_hashes: z.record(z.string()).optional(),
});

export type ProofData = z.infer<typeof proofDataSchema>;

export type StoreTransactionData = {
  organization_id: string;
  signature: string;
  token_mint: string;
  proof_data: {
    encryption_keys: Record<string, string>;
    memo_hashes: Record<string, string>;
    file_hashes: Record<string, string[]>;
    comprehensive_encrypted_data: Record<string, string>;
    essential_data_used: Record<string, any>;
  };
  amount: number;
  transaction_type: 'payment' | 'transfer' | 'request' | 'deposit' | 'withdrawal' | 'fee';
  payment_method?: string;
  sender: {
    multisig_address: string;
    vault_address: string;
    wallet_address: string;
  };
  recipient: {
    multisig_address: string;
    vault_address: string;
  };
  invoices: Array<{
    number: string;
    amount: number;
    file_count?: number;
  }>;
  status: string;
  restricted_payment_methods?: string[];
  metadata?: {
    custom_fields?: Record<string, any>;
    payment_date?: string;
    additional_info?: string;
    files_processed?: number;
    memo_approach?: string;
    memo_data_size?: number;
    memo_hash_length?: number;
    data_structure_consistency?: Record<string, any>;
    payment_method_details?: Record<string, any>;
  };
  recipient_organization_id?: string;
  sender_name?: string;
  recipient_name?: string;
};

export type UpdateTransactionData = {
  amount?: number;
  invoices?: Array<{
    number: string;
    amount: number;
    file_count?: number;
  }>;
  memo?: string | null;
  due_date?: string | null;
  status?: string;
  payment_method?: string;
  metadata?: Record<string, any>;
};

// Export the enums for use in other parts of the app
export { transactionStatusEnum, transactionTypeEnum, paymentMethodEnum };
