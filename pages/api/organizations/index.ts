// pages/api/organizations/index.ts
import type { NextApiResponse } from 'next';
import { withAuthMiddleware } from '../_middleware/withAuth';
import { organizationRepository } from '../_services/repositories/organizationRepository';
import { createOrganizationSchema } from '@/schemas/organization.schema';
import { ApiError } from '@/types/api/errors';
import { AuthenticatedRequest } from '@/types/api/requests';
import { withRateLimit } from '../_middleware/rateLimiter';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  try {
    // GET: Retrieve organizations
    if (req.method === 'GET') {
      const organizations = await organizationRepository.getByUserId(req.supabase, req.user.id);
      return res.status(200).json({
        success: true,
        data: organizations,
      });
    }

    // POST: Create organization
    if (req.method === 'POST') {
      try {
        const isAlreadyInOrg = await organizationRepository.isUserInAnyOrganization(
          req.supabase,
          req.user.id,
        );
        if (isAlreadyInOrg) {
          return res.status(409).json({
            success: false,
            error: {
              code: 'ALREADY_IN_ORGANIZATION',
              message:
                'User is already a member of an organization. Please leave your current organization before creating a new one.',
            },
          });
        }

        const result = createOrganizationSchema.safeParse(req.body);

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

        const newOrg = await organizationRepository.create(req.supabase, result.data, req.user.id);

        return res.status(201).json({
          success: true,
          data: newOrg,
        });
      } catch (error) {
        console.error('Failed to create organization:', error);

        if (error instanceof Error && error.message.includes('already a member')) {
          return res.status(409).json({
            success: false,
            error: {
              code: 'ALREADY_IN_ORGANIZATION',
              message:
                'User is already a member of an organization. Please leave your current organization before creating a new one.',
            },
          });
        }

        return res.status(500).json(ApiError.internalServerError(error));
      }
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
