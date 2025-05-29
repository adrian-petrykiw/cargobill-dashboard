// pages/api/transactions/[id]/complete.ts
import type { NextApiResponse } from 'next';
import { withAuthMiddleware } from '../../_middleware/withAuth';
import { withRateLimit } from '../../_middleware/rateLimiter';
import { transactionRepository } from '../../_services/repositories/transactionRepository';
import { ApiError } from '@/types/api/errors';
import { AuthenticatedRequest } from '@/types/api/requests';
import { supabaseAdmin } from '../../_config/supabase';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json(ApiError.validation('Transaction ID is required'));
  }

  try {
    if (req.method !== 'PUT') {
      return res.status(405).json(ApiError.methodNotAllowed(req.method || 'unknown'));
    }

    // Get the existing transaction to check permissions and current status
    const existingTransaction = await transactionRepository.getById(id);

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
        .json(ApiError.unauthorized('You do not have permission to complete this transaction'));
    }

    // Check if transaction can be completed
    const completableStatuses = ['pending', 'confirmed'];
    if (!completableStatuses.includes(existingTransaction.status)) {
      return res
        .status(400)
        .json(
          ApiError.validation(
            `Transaction cannot be completed from status: ${existingTransaction.status}`,
          ),
        );
    }

    console.log('Completing transaction:', {
      id,
      currentStatus: existingTransaction.status,
      user: req.user.id,
    });

    // Complete the transaction (sets status to completed and completed_at timestamp)
    const completedTransaction = await transactionRepository.completeTransaction(id, req.user.id);

    console.log('Transaction completed successfully:', {
      id: completedTransaction.id,
      status: completedTransaction.status,
      completed_at: completedTransaction.completed_at,
    });

    return res.status(200).json({
      success: true,
      data: completedTransaction,
    });
  } catch (error) {
    console.error(`Error completing transaction ${id}:`, error);

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return res.status(404).json(ApiError.notFound('Transaction', id));
      }

      if (error.message.includes('permission') || error.message.includes('access')) {
        return res
          .status(403)
          .json(ApiError.unauthorized('You do not have permission to complete this transaction'));
      }
    }

    return res.status(500).json(ApiError.internalServerError(error));
  }
}

export default withRateLimit(
  (req, res) => withAuthMiddleware(handler, { validateWallet: false })(req, res),
  'payment',
);
