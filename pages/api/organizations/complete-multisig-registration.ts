// pages/api/organizations/complete-multisig-registration.ts
import { NextApiResponse } from 'next';
import { withAuthMiddleware } from '../_middleware/withAuth';
import { withRateLimit } from '../_middleware/rateLimiter';
import { organizationRepository } from '../_services/repositories/organizationRepository';
import { ApiError } from '@/types/api/errors';
import { AuthenticatedRequest } from '@/types/api/requests';
import { z } from 'zod';

const completeMultisigSchema = z.object({
  organizationData: z.object({
    business_name: z.string(),
    primary_address: z.string(),
    country: z.string(),
    business_email: z.string().email(),
    primary_phone: z.string().optional(),
  }),
  signature: z.string(),
  multisigPda: z.string(),
  createKey: z.string(),
});

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json(ApiError.methodNotAllowed(req.method || 'unknown'));
  }

  try {
    // Validate request
    const result = completeMultisigSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid completion data',
          details: result.error.format(),
        },
      });
    }

    const { organizationData, signature, multisigPda, createKey } = result.data;

    // Create organization with minimal operational wallet data
    const organization = await organizationRepository.create(
      req.supabase,
      {
        ...organizationData,
        name: organizationData.business_name,
        operational_wallet: {
          type: 'multisig',
          status: 'active',
          address: multisigPda,
          create_key: createKey,
        },
      },
      req.user.id,
    );

    return res.status(201).json({
      success: true,
      data: organization,
    });
  } catch (error) {
    console.error('Failed to complete multisig registration:', error);
    return res.status(500).json(ApiError.internalServerError(error));
  }
}

export default withRateLimit(
  (req, res) => withAuthMiddleware(handler, { validateWallet: true })(req, res),
  'standard',
);
