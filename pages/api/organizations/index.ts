// pages/api/organizations/index.ts
import type { NextApiResponse } from 'next';
import { withAuthMiddleware } from '../_middleware/withAuth';
import { organizationRepository } from '../_services/repositories/organizationRepository';
import { ApiError } from '@/types/api/errors';
import { AuthenticatedRequest } from '@/types/api/requests';
import { withRateLimit } from '../_middleware/rateLimiter';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const organizations = await organizationRepository.getByUserId(req.user.id);
      return res.status(200).json({
        success: true,
        data: organizations,
      });
    }

    return res.status(405).json(ApiError.methodNotAllowed(req.method || 'unknown'));
  } catch (error) {
    console.error('Organization API error:', error);
    return res.status(500).json(ApiError.internalServerError(error));
  }
}

export default withRateLimit(
  (req, res) => withAuthMiddleware(handler, { validateWallet: true })(req, res),
  'standard',
);
