// pages/api/transactions/[id].ts
import type { NextApiResponse } from 'next';
import { withAuthMiddleware } from '../_middleware/withAuth';
import { withRateLimit } from '../_middleware/rateLimiter';
import { transactionRepository } from '../_services/repositories/transactionRepository';
import { z } from 'zod';
import { ApiError } from '@/types/api/errors';
import { AuthenticatedRequest } from '@/types/api/requests';

// Schema for validating transaction updates (removed approved/rejected, yield/treasury)
const updateTransactionSchema = z.object({
  amount: z.number().positive().optional(),
  invoices: z
    .array(
      z.object({
        number: z.string(),
        amount: z.number(),
        file_count: z.number().optional(),
      }),
    )
    .optional(),
  memo: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  status: z
    .enum(['draft', 'pending', 'completed', 'failed', 'cancelled', 'confirmed', 'requested'])
    .optional(),
  payment_method: z
    .enum([
      'operational_wallet',
      'cashback',
      'fbo_account',
      'virtual_card',
      'physical_card',
      'external_card',
      'external_bank_account',
    ])
    .nullable()
    .optional(),
  metadata: z.record(z.any()).optional(),
});

type UpdateTransactionRequest = z.infer<typeof updateTransactionSchema>;

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json(ApiError.validation('Transaction ID is required'));
  }

  try {
    switch (req.method) {
      case 'GET':
        return await handleGetTransaction(req, res, id);
      case 'PUT':
        return await handleUpdateTransaction(req, res, id);
      default:
        return res.status(405).json(ApiError.methodNotAllowed(req.method || 'unknown'));
    }
  } catch (error) {
    console.error(`Error handling ${req.method} request for transaction ${id}:`, error);

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return res.status(404).json(ApiError.notFound('Transaction', id));
      }

      if (error.message.includes('permission') || error.message.includes('access')) {
        return res
          .status(403)
          .json(ApiError.unauthorized('You do not have permission to access this transaction'));
      }
    }

    return res.status(500).json(ApiError.internalServerError(error));
  }
}

async function handleGetTransaction(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  transactionId: string,
) {
  try {
    const transaction = await transactionRepository.getById(transactionId);

    // Check if user has access to this transaction
    // User should be part of either sender or recipient organization
    const { supabaseAdmin } = await import('../_config/supabase');

    // Get user's organization memberships
    const { data: memberships } = await supabaseAdmin
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', req.user.id);

    const userOrgIds = memberships?.map((m) => m.organization_id) || [];

    // Handle nullable sender_organization_id properly
    const hasAccess =
      (transaction.sender_organization_id &&
        userOrgIds.includes(transaction.sender_organization_id)) ||
      (transaction.recipient_organization_id &&
        userOrgIds.includes(transaction.recipient_organization_id));

    if (!hasAccess) {
      return res
        .status(403)
        .json(ApiError.unauthorized('You do not have permission to access this transaction'));
    }

    return res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    throw error; // Re-throw to be handled by main error handler
  }
}

async function handleUpdateTransaction(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  transactionId: string,
) {
  try {
    // Validate request data
    const validationResult = updateTransactionSchema.safeParse(req.body);
    if (!validationResult.success) {
      console.error('Transaction update validation error:', validationResult.error.format());
      return res
        .status(400)
        .json(ApiError.validation('Invalid update data', validationResult.error.format()));
    }

    const updateData = validationResult.data;

    // Get the existing transaction to check permissions and status
    const existingTransaction = await transactionRepository.getById(transactionId);

    // Check if user has access to this transaction
    const { supabaseAdmin } = await import('../_config/supabase');

    const { data: memberships } = await supabaseAdmin
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', req.user.id);

    const userOrgIds = memberships?.map((m) => m.organization_id) || [];

    // Handle nullable sender_organization_id properly
    const hasAccess =
      (existingTransaction.sender_organization_id &&
        userOrgIds.includes(existingTransaction.sender_organization_id)) ||
      (existingTransaction.recipient_organization_id &&
        userOrgIds.includes(existingTransaction.recipient_organization_id));

    if (!hasAccess) {
      return res
        .status(403)
        .json(ApiError.unauthorized('You do not have permission to update this transaction'));
    }

    // Check if transaction can be modified
    const modifiableStatuses = ['draft', 'scheduled'];
    if (!modifiableStatuses.includes(existingTransaction.status)) {
      return res
        .status(400)
        .json(
          ApiError.validation(
            `Transaction cannot be modified in status: ${existingTransaction.status}`,
          ),
        );
    }

    // Prepare update data with proper metadata handling
    const preparedUpdateData = {
      ...updateData,
      metadata: updateData.metadata
        ? {
            ...((existingTransaction.metadata as any) || {}),
            ...updateData.metadata,
            updated_at: new Date().toISOString(),
          }
        : existingTransaction.metadata,
    };

    console.log('Updating transaction:', {
      id: transactionId,
      updates: Object.keys(preparedUpdateData),
      payment_method: preparedUpdateData.payment_method,
      user: req.user.id,
    });

    // Update the transaction
    const updatedTransaction = await transactionRepository.update(
      transactionId,
      preparedUpdateData,
      req.user.id,
    );

    console.log('Transaction updated successfully:', {
      id: updatedTransaction.id,
      payment_method: updatedTransaction.payment_method,
    });

    return res.status(200).json({
      success: true,
      data: updatedTransaction,
    });
  } catch (error) {
    throw error; // Re-throw to be handled by main error handler
  }
}

export default withRateLimit(
  (req, res) => withAuthMiddleware(handler, { validateWallet: false })(req, res),
  'payment',
);
