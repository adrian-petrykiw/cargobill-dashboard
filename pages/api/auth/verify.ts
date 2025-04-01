// pages/api/auth/verify.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import * as privyService from '../_services/privyService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get token from cookie or Authorization header
  const headerAuthToken = req.headers.authorization?.replace(/^Bearer /, '');
  const cookieAuthToken = req.cookies['privy-token'];
  const authToken = cookieAuthToken || headerAuthToken;

  if (!authToken) {
    return res.status(401).json({ error: 'Missing authentication token' });
  }

  try {
    // Verify the token using the Privy service
    const claims = await privyService.verifyToken(authToken);

    // Return user data
    return res.status(200).json({
      authenticated: true,
      userId: claims.userId,
      claims,
    });
  } catch (error: any) {
    return res.status(401).json({
      authenticated: false,
      error: error.message,
    });
  }
}
