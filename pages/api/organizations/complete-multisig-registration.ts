// pages/api/organizations/complete-multisig-registration.ts
import { NextApiResponse } from 'next';
import { withAuthMiddleware } from '../_middleware/withAuth';
import { withRateLimit } from '../_middleware/rateLimiter';
import { organizationRepository } from '../_services/repositories/organizationRepository';
import { ApiError } from '@/types/api/errors';
import { AuthenticatedRequest } from '@/types/api/requests';
import { createOrgWithMultisigSchema } from '@/schemas/multisig.schema';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json(ApiError.methodNotAllowed(req.method || 'unknown'));
  }

  try {
    console.log('Processing multisig registration request:', {
      userId: req.user.id,
      endpoint: '/api/organizations/complete-multisig-registration',
    });

    const result = createOrgWithMultisigSchema.safeParse(req.body);
    if (!result.success) {
      console.error('Validation failed for multisig registration:', result.error.format());
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

    console.log('Creating organization with multisig wallet:', {
      businessName: organizationData.business_name,
      country: organizationData.country,
      multisigPda: multisigPda.substring(0, 8) + '...',
      createKey: createKey.substring(0, 8) + '...',
    });

    const organization = await organizationRepository.create(
      {
        name: organizationData.business_name,
        business_details: {
          email: organizationData.business_email,
          phone: '',
          website: '',
        },
        country: organizationData.country,
        entity_type: 'standalone',
        account_status: 'active',
        verification_status: 'unverified',
        subscription_tier: 'free',
        operational_wallet: {
          type: 'multisig',
          status: 'active',
          address: multisigPda,
          create_key: createKey,
          signature: signature,
          created_at: new Date().toISOString(),
        },
      },
      req.user.id,
    );

    console.log('Organization successfully created with ID:', organization.id);

    return res.status(201).json({
      success: true,
      data: organization,
    });
  } catch (error) {
    console.error('Failed to complete multisig registration:', error);

    // Log detailed error information for debugging
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack?.split('\n').slice(0, 3).join('\n'),
      });
    }

    return res.status(500).json(ApiError.internalServerError(error));
  }
}

export default withRateLimit(
  (req, res) => withAuthMiddleware(handler, { validateWallet: true })(req, res),
  'standard',
);
