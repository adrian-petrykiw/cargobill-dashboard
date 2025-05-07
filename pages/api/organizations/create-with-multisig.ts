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

    // Check if user is already in an organization
    const isAlreadyInOrg = await organizationRepository.isUserInAnyOrganization(
      req.supabase,
      req.user.id,
    );

    if (isAlreadyInOrg) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'ALREADY_IN_ORGANIZATION',
          message: 'User is already a member of an organization',
        },
      });
    }

    // Get user from database - wallet address is validated by withAuth
    const user = await userRepository.getById(req.supabase, req.user.id);

    // Create multisig transaction using the validated wallet address
    const multisigTxData = await squadsService.createMultisigTransaction({
      userWalletAddress: user.wallet_address!,
      organizationName: organizationData.business_name,
    });

    // Return only the transaction data and the organization data for creation later
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
    console.error('Failed to prepare multisig transaction:', error);
    return res.status(500).json(ApiError.internalServerError(error));
  }
}

export default withRateLimit(
  (req, res) => withAuthMiddleware(handler, { validateWallet: true })(req, res),
  'standard',
);
