// pages/api/transactions/[id]/status.ts
import type { NextApiResponse } from 'next';
import { withAuthMiddleware } from '../../_middleware/withAuth';
import { withRateLimit } from '../../_middleware/rateLimiter';
import { transactionRepository } from '../../_services/repositories/transactionRepository';
import { z } from 'zod';
import { ApiError } from '@/types/api/errors';
import { AuthenticatedRequest } from '@/types/api/requests';

// Schema for validating status updates (removed approved/rejected)
const updateStatusSchema = z.object({
  status: z.enum([
    'draft',
    'pending',
    'completed',
    'failed',
    'cancelled',
    'confirmed',
    'requested',
  ]),
});

type UpdateStatusRequest = z.infer<typeof updateStatusSchema>;

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json(ApiError.validation('Transaction ID is required'));
  }

  try {
    if (req.method !== 'PUT') {
      return res.status(405).json(ApiError.methodNotAllowed(req.method || 'unknown'));
    }

    // Validate request data
    const validationResult = updateStatusSchema.safeParse(req.body);
    if (!validationResult.success) {
      console.error('Status update validation error:', validationResult.error.format());
      return res
        .status(400)
        .json(ApiError.validation('Invalid status data', validationResult.error.format()));
    }

    const { status } = validationResult.data;

    // Get the existing transaction to check permissions
    const existingTransaction = await transactionRepository.getById(id);

    // Check if user has access to this transaction
    const { supabaseAdmin } = await import('../../_config/supabase');

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

    console.log('Updating transaction status:', {
      id,
      from: existingTransaction.status,
      to: status,
      user: req.user.id,
    });

    // Update the transaction status
    const updatedTransaction = await transactionRepository.updateStatus(id, status, req.user.id);

    console.log('Transaction status updated successfully:', {
      id: updatedTransaction.id,
      status: updatedTransaction.status,
    });

    return res.status(200).json({
      success: true,
      data: updatedTransaction,
    });
  } catch (error) {
    console.error(`Error updating transaction status for ${id}:`, error);

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return res.status(404).json(ApiError.notFound('Transaction', id));
      }

      if (error.message.includes('permission') || error.message.includes('access')) {
        return res
          .status(403)
          .json(ApiError.unauthorized('You do not have permission to update this transaction'));
      }
    }

    return res.status(500).json(ApiError.internalServerError(error));
  }
}

export default withRateLimit(
  (req, res) => withAuthMiddleware(handler, { validateWallet: false })(req, res),
  'payment',
);
