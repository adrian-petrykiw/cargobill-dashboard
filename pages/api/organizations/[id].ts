// pages/api/organizations/[id].ts
import type { NextApiResponse } from 'next';
import { withAuthMiddleware } from '../_middleware/withAuth';
import { organizationRepository } from '../_services/repositories/organizationRepository';
import { updateOrganizationSchema } from '@/schemas/organization.schema';
import { ApiError } from '@/types/api/errors';
import { AuthenticatedRequest } from '@/types/api/requests';
import { withRateLimit } from '../_middleware/rateLimiter';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || Array.isArray(id)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_PARAMETER',
        message: 'Invalid organization ID',
      },
    });
  }

  try {
    // PUT/PATCH: Update organization
    if (req.method === 'PUT' || req.method === 'PATCH') {
      // Validate user has access to this organization
      const organizations = await organizationRepository.getByUserId(req.user.id);
      const userHasAccess = organizations.some((org) => org.id === id);

      if (!userHasAccess) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have access to this organization',
          },
        });
      }

      // Validate input data
      const result = updateOrganizationSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid organization data',
            details: result.error.format(),
          },
        });
      }

      // Update organization
      const updatedOrg = await organizationRepository.update(id, result.data);

      return res.status(200).json({
        success: true,
        data: updatedOrg,
      });
    }

    // GET: Get single organization
    if (req.method === 'GET') {
      const organization = await organizationRepository.getById(id);

      const organizations = await organizationRepository.getByUserId(req.user.id);
      const userHasAccess = organizations.some((org) => org.id === id);

      if (!userHasAccess) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have access to this organization',
          },
        });
      }

      return res.status(200).json({
        success: true,
        data: organization,
      });
    }

    // DELETE: Not supported
    if (req.method === 'DELETE') {
      return res.status(405).json({
        success: false,
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: 'Organization deletion is not supported through this endpoint',
        },
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
