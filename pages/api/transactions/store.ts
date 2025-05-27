// pages/api/transactions/store.ts
import type { NextApiResponse } from 'next';
import { withAuthMiddleware } from '../_middleware/withAuth';
import { withRateLimit } from '../_middleware/rateLimiter';
import { transactionRepository } from '../_services/repositories/transactionRepository';
import { z } from 'zod';
import { ApiError } from '@/types/api/errors';
import { AuthenticatedRequest } from '@/types/api/requests';

// Schema for validating the incoming transaction data from the frontend
const storeTransactionSchema = z.object({
  organization_id: z.string().uuid(),
  signature: z.string(),
  token_mint: z.string(),
  proof_data: z.object({
    encryption_keys: z.record(z.string()),
    memo_hashes: z.record(z.string()),
    file_hashes: z.record(z.array(z.string())),
    comprehensive_encrypted_data: z.record(z.string()),
    essential_data_used: z.record(z.any()),
  }),
  amount: z.number().positive(),
  transaction_type: z.enum(['payment', 'transfer', 'request', 'other']),
  sender: z.object({
    multisig_address: z.string(),
    vault_address: z.string(),
    wallet_address: z.string(),
  }),
  recipient: z.object({
    multisig_address: z.string(),
    vault_address: z.string(),
  }),
  invoices: z.array(
    z.object({
      number: z.string(),
      amount: z.number(),
      file_count: z.number().optional(),
    }),
  ),
  status: z.string().default('confirmed'),
  restricted_payment_methods: z.array(z.string()).optional(),
  metadata: z
    .object({
      custom_fields: z.record(z.any()).optional(),
      payment_date: z.string().optional(),
      additional_info: z.string().optional(),
      files_processed: z.number().optional(),
      memo_approach: z.string().optional(),
      memo_data_size: z.number().optional(),
      memo_hash_length: z.number().optional(),
      data_structure_consistency: z.record(z.any()).optional(),
    })
    .optional(),
  // Optional fields that might be provided
  recipient_organization_id: z.string().uuid().optional(),
  sender_name: z.string().optional(),
  recipient_name: z.string().optional(),
});

type StoreTransactionRequest = z.infer<typeof storeTransactionSchema>;

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  try {
    // Only allow POST method
    if (req.method !== 'POST') {
      return res.status(405).json(ApiError.methodNotAllowed(req.method || 'unknown'));
    }

    // Validate request data
    const validationResult = storeTransactionSchema.safeParse(req.body);
    if (!validationResult.success) {
      console.error('Transaction validation error:', validationResult.error.format());
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid transaction data',
          details: validationResult.error.format(),
        },
      });
    }

    const transactionData = validationResult.data;

    // Get sender organization data to populate sender_name
    let senderName = transactionData.sender_name || 'Unknown Sender';
    try {
      const { supabaseAdmin } = await import('../_config/supabase');
      const { data: senderOrg } = await supabaseAdmin
        .from('organizations')
        .select('name')
        .eq('id', transactionData.organization_id)
        .single();

      if (senderOrg) {
        senderName = senderOrg.name;
      }
    } catch (error) {
      console.warn('Could not fetch sender organization name:', error);
    }

    // Determine recipient organization ID and name
    // The frontend should eventually pass this, but for now we'll handle the case where it's missing
    let recipientOrganizationId = transactionData.recipient_organization_id || null;
    let recipientName = transactionData.recipient_name || 'Unknown Recipient';

    // If we don't have recipient org ID, we need to determine it from the recipient multisig address
    if (!recipientOrganizationId) {
      try {
        const { supabaseAdmin } = await import('../_config/supabase');
        const { data: recipientOrg } = await supabaseAdmin
          .from('organizations')
          .select('id, name')
          .eq('operational_wallet->>address', transactionData.recipient.multisig_address)
          .single();

        if (recipientOrg) {
          recipientOrganizationId = recipientOrg.id;
          recipientName = recipientOrg.name;
        }
      } catch (error) {
        console.warn('Could not determine recipient organization from multisig address:', error);
      }
    }

    // Map the frontend data to the database schema format
    const dbTransactionData = {
      amount: transactionData.amount,
      fee_amount: 0, // Default fee amount, can be updated if provided
      currency: 'USD', // Default to USD, could be derived from token_mint
      signature: transactionData.signature,
      token_mint: transactionData.token_mint,
      transaction_type: transactionData.transaction_type,
      status: transactionData.status,
      sender_organization_id: transactionData.organization_id,
      recipient_organization_id: recipientOrganizationId,
      sender_name: senderName,
      recipient_name: recipientName,
      invoices: transactionData.invoices,
      proof_data: transactionData.proof_data,
      metadata: {
        ...transactionData.metadata,
        sender_details: transactionData.sender,
        recipient_details: transactionData.recipient,
        restricted_payment_methods: transactionData.restricted_payment_methods || [],
      },
      memo: null, // Could be extracted from proof_data if needed
      due_date: null, // Could be set based on payment terms
      completed_at: transactionData.status === 'confirmed' ? new Date().toISOString() : null,
    };

    console.log('Storing transaction with mapped data:', {
      sender_org: transactionData.organization_id,
      recipient_org: recipientOrganizationId,
      amount: transactionData.amount,
      signature: transactionData.signature,
      invoices_count: transactionData.invoices.length,
    });

    // Store the transaction using the repository
    const storedTransaction = await transactionRepository.create(dbTransactionData, req.user.id);

    console.log('Transaction stored successfully:', storedTransaction.id);

    return res.status(201).json({
      success: true,
      data: storedTransaction,
    });
  } catch (error) {
    console.error('Error storing transaction:', error);

    // Handle specific database errors
    if (error instanceof Error) {
      if (error.message.includes('duplicate key')) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_TRANSACTION',
            message: 'Transaction with this signature already exists',
          },
        });
      }

      if (error.message.includes('foreign key')) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REFERENCE',
            message: 'Referenced organization or user not found',
          },
        });
      }
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'STORE_ERROR',
        message: 'Failed to store transaction',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

export default withRateLimit(
  (req, res) => withAuthMiddleware(handler, { validateWallet: false })(req, res),
  'payment',
);
