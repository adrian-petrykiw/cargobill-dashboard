// pages/api/auth/verify.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import * as privyService from '../_services/privyService';
import { ApiError } from '@/types/api/errors';
import { withRateLimit } from '../_middleware/rateLimiter';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(ApiError.methodNotAllowed(req.method || 'unknown'));
  }

  const headerAuthToken = req.headers.authorization?.replace(/^Bearer /, '');
  const cookieAuthToken = req.cookies['privy-token'];
  const authToken = cookieAuthToken || headerAuthToken;

  if (!authToken) {
    return res.status(401).json(ApiError.unauthorized('Missing authentication token'));
  }

  try {
    const claims = await privyService.verifyToken(authToken);

    return res.status(200).json({
      success: true,
      data: {
        authenticated: true,
        userId: claims.userId,
      },
    });
  } catch (error: any) {
    return res.status(401).json(ApiError.unauthorized('Authentication verification failed'));
  }
}

export default withRateLimit(handler, 'auth');
