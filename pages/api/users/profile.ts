// pages/api/users/profile.ts
import type { NextApiResponse } from 'next';
import { withAuthMiddleware } from '../_middleware/withAuth';
import { withRateLimit } from '../_middleware/rateLimiter';
import { userRepository } from '../_services/repositories/userRepository';
import { updateProfileSchema } from '@/schemas/user.schema';
import { ApiError } from '@/types/api/errors';
import { AuthenticatedRequest } from '@/types/api/requests';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  try {
    // GET: Retrieve current user profile
    if (req.method === 'GET') {
      try {
        // Check if req.user exists and has an id
        if (!req.user || !req.user.id) {
          console.error('Auth middleware failed to set req.user or req.user.id');
          return res.status(401).json({
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'You must be logged in to access this resource',
            },
          });
        }

        const profile = await userRepository.getById(req.user.id);
        return res.status(200).json({
          success: true,
          data: profile,
        });
      } catch (error) {
        console.error('Error fetching user profile:', error);
        // If the error is "User not found", return a more specific error message
        if (error instanceof Error && error.message.includes('User not found')) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'USER_NOT_FOUND',
              message: 'User profile not found',
            },
          });
        }
        return res.status(500).json(ApiError.internalServerError(error));
      }
    }

    // PUT: Update user profile
    if (req.method === 'PUT') {
      try {
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

        const updatedProfile = await userRepository.update(req.user.id, result.data);

        return res.status(200).json({
          success: true,
          data: updatedProfile,
        });
      } catch (error) {
        console.error('Failed to update profile:', error);
        return res.status(500).json(ApiError.internalServerError(error));
      }
    }

    return res.status(405).json(ApiError.methodNotAllowed(req.method || 'unknown'));
  } catch (error) {
    console.error('User profile API error:', error);
    return res.status(500).json(ApiError.internalServerError(error));
  }
}

export default withRateLimit(
  (req, res) => withAuthMiddleware(handler, { validateWallet: false })(req, res),
  'standard',
);
