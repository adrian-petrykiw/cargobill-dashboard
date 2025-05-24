// pages/api/banking/account-info.ts
import { NextApiResponse } from 'next';
import { withAuthMiddleware } from '../_middleware/withAuth';
import { withRateLimit } from '../_middleware/rateLimiter';
import { AuthenticatedRequest } from '@/types/api/requests';
import { ApiError } from '@/types/api/errors';
import { getAccountDetails } from '../_services/bankingService';
import { organizationRepository } from '../_services/repositories/organizationRepository';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(ApiError.methodNotAllowed(req.method || 'unknown'));
  }

  try {
    console.log('Banking account-info request for user:', req.user.id);

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

    // Get account details using the FBO account ID
    console.log('Fetching account details for FBO account:', organization.fbo_account_id);

    let accountDetails;
    try {
      accountDetails = await getAccountDetails(organization.fbo_account_id);
      console.log('Account details fetched:', accountDetails);
    } catch (bankingError) {
      console.error('Banking service error:', bankingError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'BANKING_SERVICE_ERROR',
          message: 'Failed to fetch account details from banking service',
          details: bankingError instanceof Error ? bankingError.message : String(bankingError),
        },
      });
    }

    if (!accountDetails) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ACCOUNT_NOT_FOUND',
          message: 'Bank account not found or not active',
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: accountDetails,
    });
  } catch (error) {
    console.error('Unexpected error in account-info endpoint:', error);
    return res.status(500).json(ApiError.internalServerError(error));
  }
}

export default withRateLimit((req, res) => withAuthMiddleware(handler)(req, res), 'standard');
