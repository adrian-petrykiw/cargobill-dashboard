// pages/api/_middleware/withAuth.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { createSupabaseClient } from '../_config/supabase';
import * as privyService from '../_services/privyService';
import { userRepository } from '../_services/repositories/userRepository';
import { ApiError } from '@/types/api/errors';
import { AuthenticatedRequest } from '@/types/api/requests';

export function withAuthMiddleware(
  handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void>,
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
      const dbUser = await userRepository.getByAuthIdSystem(privyClaims.userId);

      if (!dbUser) {
        return res.status(401).json(ApiError.unauthorized('User not registered in system'));
      }

      // Attach user to request
      const authenticatedReq = req as AuthenticatedRequest;
      authenticatedReq.user = {
        id: dbUser.id,
        authId: privyClaims.userId,
      };

      // Create Supabase client with user context
      authenticatedReq.supabase = createSupabaseClient(authenticatedReq);

      return handler(authenticatedReq, res);
    } catch (error) {
      console.error('API authentication error:', error);
      return res.status(401).json(ApiError.unauthorized('Invalid authentication token'));
    }
  };
}
