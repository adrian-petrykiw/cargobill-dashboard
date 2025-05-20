// pages/api/vendors/[id].ts
import type { NextApiResponse } from 'next';
import { withAuthMiddleware } from '../_middleware/withAuth';
import { supabaseAdmin } from '../_config/supabase';
import { ApiError } from '@/types/api/errors';
import { AuthenticatedRequest } from '@/types/api/requests';
import { withRateLimit } from '../_middleware/rateLimiter';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(ApiError.methodNotAllowed(req.method || 'unknown'));
  }

  const { id } = req.query;

  if (!id || Array.isArray(id)) {
    return res.status(400).json(ApiError.validation('Invalid vendor ID'));
  }

  try {
    // Only fetch the essential fields needed for vendors
    const { data: org, error } = await supabaseAdmin
      .from('organizations')
      .select(
        `
        id,
        name,
        country,
        business_details,
        entity_type,
        industry,
        verification_status,
        subscription_tier,
        operational_wallet
      `,
      )
      .eq('id', id)
      .single();

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    if (!org) {
      return res.status(404).json(ApiError.notFound('Vendor', id));
    }

    // Extract multisig address from operational wallet
    const operationalWallet = org.operational_wallet as any;
    const multisigAddress =
      operationalWallet && typeof operationalWallet === 'object'
        ? operationalWallet.address
        : undefined;

    if (!multisigAddress) {
      return res.status(400).json(ApiError.validation('Vendor has no valid multisig address'));
    }

    // Construct a simplified vendor details object with only what's needed
    // We're explicitly picking fields instead of spreading to avoid
    // including unnecessary data
    const vendorDetails = {
      id: org.id,
      name: org.name,
      country: org.country,
      business_details: org.business_details || {}, // Ensure this is an object
      entity_type: org.entity_type,
      industry: org.industry,
      verification_status: org.verification_status,
      subscription_tier: org.subscription_tier,
      multisigAddress,
    };

    return res.status(200).json({
      success: true,
      data: vendorDetails,
    });
  } catch (error) {
    console.error('Error fetching vendor details:', error);
    return res.status(500).json(ApiError.internalServerError(error));
  }
}

export default withRateLimit(
  (req, res) => withAuthMiddleware(handler, { validateWallet: true })(req, res),
  'standard',
);
