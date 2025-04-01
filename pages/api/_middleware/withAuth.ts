// pages/api/_middleware/withAuth.ts
import { NextApiRequest, NextApiResponse } from 'next';
import * as supabaseService from '../_services/supabaseService';
import * as privyService from '../_services/privyService';

export function withAuthMiddleware(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Get token from cookie or Authorization header
    const headerAuthToken = req.headers.authorization?.replace(/^Bearer /, '');
    const cookieAuthToken = req.cookies['privy-token'];
    const authToken = cookieAuthToken || headerAuthToken;

    if (!authToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      // Verify the token using Privy
      const privyClaims = await privyService.verifyToken(authToken);

      // Get user from database
      const privyUser = await privyService.getUser(privyClaims.userId);
      const dbUser = await supabaseService.getOrCreateUser(privyClaims.userId, privyUser);

      // Add user data to the request
      (req as any).user = {
        id: dbUser.id,
        privyId: privyClaims.userId,
        email: dbUser.email,
        walletAddress: dbUser.wallet_address,
        // Add other user properties as needed
      };

      // Continue to the API route handler
      return handler(req, res);
    } catch (error) {
      console.error('API authentication error:', error);
      return res.status(401).json({ error: 'Invalid authentication token' });
    }
  };
}
