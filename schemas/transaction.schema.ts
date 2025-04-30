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
  recipient_organization_id: z.string().nullable().optional(),
  sender_organization_id: z.string().nullable().optional(),
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
  })
  .extend({
    created_at: z.string().optional(),
    status: z
      .enum(['pending', 'scheduled', 'processing', 'completed', 'failed', 'cancelled'])
      .default('pending'),
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
