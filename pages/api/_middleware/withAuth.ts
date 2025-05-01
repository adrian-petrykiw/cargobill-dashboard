// pages/api/_middleware/withAuth.ts
import { NextApiRequest, NextApiResponse } from 'next';
import * as privyService from '../_services/privyService';
import { userRepository } from '../_services/repositories/userRepository';
import { ApiError } from '@/types/api/errors';

export function withAuthMiddleware(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const headerAuthToken = req.headers.authorization?.replace(/^Bearer /, '');
    const cookieAuthToken = req.cookies['privy-token'];
    const authToken = cookieAuthToken || headerAuthToken;

    if (!authToken) {
      return res.status(401).json(ApiError.unauthorized('Authentication required'));
    }

    try {
      const privyClaims = await privyService.verifyToken(authToken);
      const dbUser = await userRepository.getByAuthId(privyClaims.userId);

      if (!dbUser) {
        return res.status(401).json(ApiError.unauthorized('User not registered in system'));
      }

      (req as any).user = {
        id: dbUser.id,
        authId: privyClaims.userId,
      };

      return handler(req, res);
    } catch (error) {
      console.error('API authentication error:', error);
      return res.status(401).json(ApiError.unauthorized('Invalid authentication token'));
    }
  };
}
