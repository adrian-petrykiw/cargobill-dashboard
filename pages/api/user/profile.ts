// pages/api/users/profile.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuthMiddleware } from '../_middleware/withAuth';
import { withRateLimit } from '../_middleware/rateLimiter';
import { userRepository } from '../_services/repositories/userRepository';
import { updateProfileSchema } from '@/schemas/user.schema';
import { ApiError } from '@/types/api/errors';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { user } = req as any; // From middleware

  try {
    // GET: Retrieve current user profile
    if (req.method === 'GET') {
      const profile = await userRepository.getById(user.id);
      return res.status(200).json({
        success: true,
        data: profile,
      });
    }

    // PUT: Update user profile
    if (req.method === 'PUT') {
      try {
        // Validate with Zod
        const result = updateProfileSchema.safeParse(req.body);

        if (!result.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid profile data',
              details: result.error.format(),
            },
          });
        }

        const updatedProfile = await userRepository.update(user.id, result.data);

        return res.status(200).json({
          success: true,
          data: updatedProfile,
        });
      } catch (error) {
        console.error('Failed to update profile:', error);
        return res.status(500).json(ApiError.internalServerError(error));
      }
    }

    // Method not allowed
    return res.status(405).json(ApiError.methodNotAllowed(req.method || 'unknown'));
  } catch (error) {
    console.error('User profile API error:', error);
    return res.status(500).json(ApiError.internalServerError(error));
  }
}

export default withAuthMiddleware(withRateLimit(handler, 'standard'));
