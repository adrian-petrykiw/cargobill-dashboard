// pages/api/transactions/organization/[organizationId].ts
import type { NextApiResponse } from 'next';
import { withAuthMiddleware } from '../../_middleware/withAuth';
import { withRateLimit } from '../../_middleware/rateLimiter';
import { transactionRepository } from '../../_services/repositories/transactionRepository';
import { ApiError } from '@/types/api/errors';
import { AuthenticatedRequest } from '@/types/api/requests';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const { organizationId } = req.query;

  console.log('Organization transactions API called:', {
    organizationId,
    method: req.method,
    userId: req.user?.id,
  });

  if (!organizationId || typeof organizationId !== 'string') {
    console.error('Invalid organizationId:', organizationId);
    return res.status(400).json(ApiError.validation('Organization ID is required'));
  }

  try {
    if (req.method !== 'GET') {
      return res.status(405).json(ApiError.methodNotAllowed(req.method || 'unknown'));
    }

    // Check if user has access to this organization
    const { supabaseAdmin } = await import('../../_config/supabase');

    console.log('Checking organization membership for user:', req.user.id);

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('organization_members')
      .select('organization_id, role, status')
      .eq('user_id', req.user.id)
      .eq('organization_id', organizationId)
      .single();

    if (membershipError) {
      console.error('Error checking organization membership:', membershipError);
      // Don't return 404 here, check if it's because user is not a member
      if (membershipError.code === 'PGRST116') {
        // No rows returned - user is not a member
        return res
          .status(403)
          .json(
            ApiError.unauthorized(
              "You do not have permission to access this organization's transactions",
            ),
          );
      }
      // Other database error
      return res.status(500).json(ApiError.internalServerError(membershipError));
    }

    if (!membership) {
      console.log('User is not a member of organization:', organizationId);
      return res
        .status(403)
        .json(
          ApiError.unauthorized(
            "You do not have permission to access this organization's transactions",
          ),
        );
    }

    console.log('User membership verified:', {
      organizationId,
      userId: req.user.id,
      role: membership.role,
      status: membership.status,
    });

    console.log('Fetching all transactions for organization:', organizationId);

    const transactions = await transactionRepository.getByOrganizationId(organizationId);

    console.log('Successfully fetched transactions:', {
      count: transactions.length,
      organizationId,
      sampleTransaction: transactions[0]
        ? {
            id: transactions[0].id,
            sender_org: transactions[0].sender_organization_id,
            recipient_org: transactions[0].recipient_organization_id,
            amount: transactions[0].amount,
            status: transactions[0].status,
          }
        : null,
    });

    return res.status(200).json({
      success: true,
      data: transactions,
      meta: {
        count: transactions.length,
        organizationId,
        userId: req.user.id,
      },
    });
  } catch (error) {
    console.error(`Error fetching transactions for ${organizationId}:`, error);

    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
      });

      if (error.message.includes('not found')) {
        return res.status(404).json(ApiError.notFound('Organization', organizationId));
      }

      if (error.message.includes('permission') || error.message.includes('access')) {
        return res
          .status(403)
          .json(
            ApiError.unauthorized(
              "You do not have permission to access this organization's transactions",
            ),
          );
      }
    }

    return res.status(500).json(ApiError.internalServerError(error));
  }
}

export default withRateLimit(
  (req, res) => withAuthMiddleware(handler, { validateWallet: false })(req, res),
  'standard',
);
