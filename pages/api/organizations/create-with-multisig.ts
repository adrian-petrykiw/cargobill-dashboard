// pages/api/organizations/create-with-multisig.ts
import { NextApiResponse } from 'next';
import { withAuthMiddleware } from '../_middleware/withAuth';
import { withRateLimit } from '../_middleware/rateLimiter';
import { organizationRepository } from '../_services/repositories/organizationRepository';
import { userRepository } from '../_services/repositories/userRepository';
import { squadsService } from '../_services/squadsService';
import { onboardingOrganizationSchema } from '@/schemas/organization.schema';
import { ApiError } from '@/types/api/errors';
import { AuthenticatedRequest } from '@/types/api/requests';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json(ApiError.methodNotAllowed(req.method || 'unknown'));
  }

  try {
    // Validate request
    const result = onboardingOrganizationSchema.safeParse(req.body);
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

    const organizationData = result.data;

    console.log(`Processing multisig creation for user ID: ${req.user.id}`);

    // Get user from database with better error handling
    let user;
    try {
      // Extract and validate the ID
      const userId = req.user.id;
      if (typeof userId !== 'string') {
        console.error(`Invalid user ID type: ${typeof userId}, value:`, userId);
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_USER_ID',
            message: 'Invalid user ID format',
          },
        });
      }

      user = await userRepository.getById(userId);
      console.log(`Retrieved user: ${user.id}, wallet: ${user.wallet_address?.substring(0, 8)}...`);
    } catch (error) {
      console.error('Failed to get user for multisig creation:', error);
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: error instanceof Error ? error.message : 'User not found',
        },
      });
    }

    // Create multisig transaction using the validated wallet address
    try {
      const multisigTxData = await squadsService.createMultisigTransaction({
        userWalletAddress: user.wallet_address!,
        organizationName: organizationData.business_name,
      });

      return res.status(200).json({
        success: true,
        data: {
          organizationData,
          multisigData: {
            serializedTransaction: multisigTxData.serializedTransaction,
            multisigPda: multisigTxData.multisigPda,
            createKey: multisigTxData.createKey,
            blockhash: multisigTxData.blockhash,
            lastValidBlockHeight: multisigTxData.lastValidBlockHeight,
          },
        },
      });
    } catch (error) {
      console.error('Failed to create multisig transaction:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'MULTISIG_CREATION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to create multisig transaction',
        },
      });
    }
  } catch (error) {
    console.error('Unexpected error in create-with-multisig endpoint:', error);
    return res.status(500).json(ApiError.internalServerError(error));
  }
}

export default withRateLimit(
  (req, res) => withAuthMiddleware(handler, { validateWallet: true })(req, res),
  'standard',
);
