// schemas/banking.schema.ts
import { z } from 'zod';

// Backend transaction schema (matches Slipstream API)
export const bankingTransactionSchema = z.object({
  transaction_id: z.number(),
  transaction_amount: z.string(),
  transaction_method: z.string(),
  transaction_name: z.string(),
  transaction_type: z.string(),
  transaction_status: z.string(),
  transaction_date: z.string(),
  purpose: z.string(),
  class: z.string(),
  status_reason: z.string(),
  allow_duplicate: z.boolean(),
  created_by: z.string(),
  changed_by: z.string(),
});

// Frontend transfer schema (for UI display)
export const bankingTransferSchema = z.object({
  transfer_id: z.number(),
  transfer_amount: z.string(),
  transfer_method: z.string(),
  transfer_name: z.string(),
  transfer_type: z.string(),
  transfer_status: z.string(),
  transfer_date: z.string(),
  purpose: z.string(),
  class: z.string(),
  status_reason: z.string(),
  allow_duplicate: z.boolean(),
  created_by: z.string(),
  changed_by: z.string(),
});

export const accountDetailSchema = z.object({
  account_id: z.union([z.string(), z.number()]).transform((val) => String(val)),
  account_type: z.string(),
  account_name: z.string(),
  account_status: z.string(),
  routing_num: z.string(),
  account_num: z.string(),
  routing_account: z.string(),
  balance: z.string().optional(),
});

export const accountInfoResponseSchema = z.object({
  AccountDetail: z.array(accountDetailSchema),
});

export const transactionsResponseSchema = z.object({
  values: z.array(bankingTransactionSchema),
});

export const transfersResponseSchema = z.object({
  values: z.array(bankingTransferSchema),
});

export const transferHistoryParamsSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
});

// Backend types (for API communication)
export type BankingTransaction = z.infer<typeof bankingTransactionSchema>;
export type TransactionsResponse = z.infer<typeof transactionsResponseSchema>;

// Frontend types (for UI display)
export type BankingTransfer = z.infer<typeof bankingTransferSchema>;
export type TransfersResponse = z.infer<typeof transfersResponseSchema>;

// Shared types
export type AccountDetail = z.infer<typeof accountDetailSchema>;
export type AccountInfoResponse = z.infer<typeof accountInfoResponseSchema>;
export type TransferHistoryParams = z.infer<typeof transferHistoryParamsSchema>;

// Transform function to convert backend transaction to frontend transfer
export const transformTransactionToTransfer = (
  transaction: BankingTransaction,
): BankingTransfer => ({
  transfer_id: transaction.transaction_id,
  transfer_amount: transaction.transaction_amount,
  transfer_method: transaction.transaction_method,
  transfer_name: transaction.transaction_name,
  transfer_type: transaction.transaction_type,
  transfer_status: transaction.transaction_status,
  transfer_date: transaction.transaction_date,
  purpose: transaction.purpose,
  class: transaction.class,
  status_reason: transaction.status_reason,
  allow_duplicate: transaction.allow_duplicate,
  created_by: transaction.created_by,
  changed_by: transaction.changed_by,
});

// Transform function to convert backend response to frontend response with error handling
export const transformTransactionsToTransfers = (
  response: TransactionsResponse | null | undefined,
): TransfersResponse => {
  // Handle null, undefined, or invalid response
  if (!response || !response.values || !Array.isArray(response.values)) {
    console.warn('Invalid transactions response for transformation:', response);
    return { values: [] };
  }

  try {
    return {
      values: response.values.map(transformTransactionToTransfer),
    };
  } catch (error) {
    console.error('Error transforming transactions to transfers:', error);
    return { values: [] };
  }
};
