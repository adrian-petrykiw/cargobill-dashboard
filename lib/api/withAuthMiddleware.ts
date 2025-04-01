// lib/api/withAuthMiddleware.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PrivyClient } from '@privy-io/server-auth';

// Create the client only in server-side contexts
const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;
const privyClient = new PrivyClient(PRIVY_APP_ID!, PRIVY_APP_SECRET!);

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
      // Verify the token
      const claims = await privyClient.verifyAuthToken(authToken);

      // Add user data to the request
      (req as any).user = {
        id: claims.userId,
        claims,
      };

      // Continue to the API route handler
      return handler(req, res);
    } catch (error) {
      console.error('API authentication error:', error);
      return res.status(401).json({ error: 'Invalid authentication token' });
    }
  };
}
