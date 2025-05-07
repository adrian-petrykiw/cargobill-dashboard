// pages/api/_middleware/withAuth.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { createSupabaseClient } from '../_config/supabase';
import * as privyService from '../_services/privyService';
import { userRepository } from '../_services/repositories/userRepository';
import { ApiError } from '@/types/api/errors';
import { AuthenticatedRequest } from '@/types/api/requests';

interface AuthOptions {
  validateWallet?: boolean;
}

export function withAuthMiddleware(
  handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void>,
  options: AuthOptions = {},
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

      // Optional wallet validation
      if (options.validateWallet) {
        // Get user from Privy to verify wallet consistency
        const privyUser = await privyService.getUser(privyClaims.userId);

        // Check if wallet exists in database
        if (!dbUser.wallet_address) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'MISSING_WALLET',
              message: 'User wallet address not found in database. Please complete your profile.',
            },
          });
        }

        // Check if wallet exists in Privy
        if (!privyUser?.wallet?.address) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'MISSING_WALLET',
              message: 'User wallet address not found in Privy. Please reconnect your wallet.',
            },
          });
        }

        // Verify wallet addresses match
        if (dbUser.wallet_address !== privyUser.wallet.address) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'WALLET_MISMATCH',
              message:
                'Wallet address mismatch between database and Privy. Please update your profile or reconnect your wallet.',
            },
          });
        }
      }

      // Attach user to request
      const authenticatedReq = req as AuthenticatedRequest;
      authenticatedReq.user = {
        id: String(dbUser.id), // Force string conversion
        authId: String(privyClaims.userId), // Force string conversion
      };

      authenticatedReq.headers = req.headers;

      // authenticatedReq.supabase = createSupabaseClient(authenticatedReq);

      return handler(authenticatedReq, res);
    } catch (error) {
      console.error('API authentication error:', error);
      return res.status(401).json(ApiError.unauthorized('Invalid authentication token'));
    }
  };
}
