// schemas/transaction.schema.ts
import { z } from 'zod';
import { jsonSchema } from './common';

export const transactionSchema = z.object({
  id: z.string().uuid(),
  amount: z.number().positive(),
  created_at: z.string(),
  created_by: z.string(),
  fee_amount: z.number().default(0),
  invoices: jsonSchema,
  recipient_name: z.string(),
  sender_name: z.string(),
  status: z.string(),
  token_mint: z.string(),
  transaction_type: z.string(),
  completed_at: z.string().nullable().optional(),
  currency: z.string().default('USD'),
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
    status: z
      .enum(['pending', 'scheduled', 'processing', 'confirmed', 'completed', 'failed', 'cancelled'])
      .default('pending'),
    transaction_type: z.enum(['payment', 'transfer', 'request', 'other']),
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
  .required({ id: true });

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
