// pages/api/organizations/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuthMiddleware } from '../_middleware/withAuth';
import { organizationRepository } from '../_services/repositories/organizationRepository';
import { createOrganizationSchema } from '@/schemas/organization.schema';
import { ApiError } from '@/types/api/errors';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { user } = req as any; // From middleware

  try {
    // GET: Retrieve organizations
    if (req.method === 'GET') {
      const organizations = await organizationRepository.getByUserId(user.id);
      return res.status(200).json({
        success: true,
        data: organizations,
      });
    }

    // POST: Create organization
    if (req.method === 'POST') {
      try {
        // Validate with Zod
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

        const newOrg = await organizationRepository.create(result.data, user.id);

        return res.status(201).json({
          success: true,
          data: newOrg,
        });
      } catch (error) {
        console.error('Failed to create organization:', error);
        return res.status(500).json(ApiError.internalServerError(error));
      }
    }

    // Method not allowed
    return res.status(405).json(ApiError.methodNotAllowed(req.method || 'unknown'));
  } catch (error) {
    console.error('Organization API error:', error);
    return res.status(500).json(ApiError.internalServerError(error));
  }
}

export default withAuthMiddleware(handler);
