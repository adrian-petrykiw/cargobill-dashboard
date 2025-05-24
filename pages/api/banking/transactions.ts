// pages/api/banking/transactions.ts
import { NextApiResponse } from 'next';
import { withAuthMiddleware } from '../_middleware/withAuth';
import { withRateLimit } from '../_middleware/rateLimiter';
import { AuthenticatedRequest } from '@/types/api/requests';
import { ApiError } from '@/types/api/errors';
import { getTransactionHistory } from '../_services/bankingService';
import { organizationRepository } from '../_services/repositories/organizationRepository';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(ApiError.methodNotAllowed(req.method || 'unknown'));
  }

  try {
    console.log('Banking transactions request for user:', req.user.id);

    // Get query parameters
    const { startDate, endDate, limit, offset } = req.query;
    console.log('Query parameters:', { startDate, endDate, limit, offset });

    // Get user's organizations
    let organizations;
    try {
      organizations = await organizationRepository.getByUserId(req.user.id);
      console.log('Organizations found:', organizations?.length || 0);
    } catch (orgError) {
      console.error('Error fetching organizations:', orgError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'ORGANIZATION_FETCH_ERROR',
          message: 'Failed to fetch user organizations',
          details: orgError instanceof Error ? orgError.message : String(orgError),
        },
      });
    }

    if (!organizations || organizations.length === 0) {
      console.log('No organizations found for user:', req.user.id);
      return res.status(404).json({
        success: false,
        error: {
          code: 'ORGANIZATION_NOT_FOUND',
          message: 'User is not associated with any organization',
        },
      });
    }

    const organization = organizations[0]; // Get the first organization
    console.log('Using organization:', {
      id: organization.id,
      fbo_account_id: organization.fbo_account_id,
    });

    if (!organization.fbo_account_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'FBO_ACCOUNT_NOT_CONFIGURED',
          message:
            'Organization does not have an FBO account configured. Please contact support to set up banking.',
        },
      });
    }

    // Build options for transaction history
    const options: any = {};
    if (startDate && typeof startDate === 'string') options.startDate = startDate;
    if (endDate && typeof endDate === 'string') options.endDate = endDate;
    if (limit && typeof limit === 'string') options.limit = parseInt(limit, 10);
    if (offset && typeof offset === 'string') options.offset = parseInt(offset, 10);

    console.log('Transaction options:', options);

    // Get transaction history using the FBO account ID
    console.log('Fetching transaction history for FBO account:', organization.fbo_account_id);

    let transactions;
    try {
      transactions = await getTransactionHistory(organization.fbo_account_id, options);
      console.log('Transactions fetched:', {
        count: transactions?.values?.length || 0,
        sample: transactions?.values?.[0],
      });
    } catch (bankingError) {
      console.error('Banking service error:', bankingError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'BANKING_SERVICE_ERROR',
          message: 'Failed to fetch transaction history from banking service',
          details: bankingError instanceof Error ? bankingError.message : String(bankingError),
        },
      });
    }

    // Ensure we have a valid response structure
    if (!transactions) {
      transactions = { values: [] };
    }

    return res.status(200).json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    console.error('Unexpected error in transactions endpoint:', error);
    return res.status(500).json(ApiError.internalServerError(error));
  }
}

export default withRateLimit((req, res) => withAuthMiddleware(handler)(req, res), 'standard');
