// pages/api/footprint/beneficial-owner-token.ts
import type { NextApiResponse } from 'next';
import { withAuthMiddleware } from '../_middleware/withAuth';
import { AuthenticatedRequest } from '@/types/api/requests';
import { withRateLimit } from '../_middleware/rateLimiter';
import { footprintService } from '../_services/footprintService';
import { ApiError } from '@/types/api/errors';
import { supabaseAdmin } from '../_config/supabase';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json(ApiError.methodNotAllowed(req.method || 'unknown'));
  }

  try {
    const { organizationId, ownerIndex, fields } = req.body;

    // Validate required parameters
    if (!organizationId || ownerIndex === undefined || !fields || !Array.isArray(fields)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message:
            'Missing required parameters: organizationId, ownerIndex, and fields array are required',
        },
      });
    }

    // Check if user is a member of the specified organization
    const { data: memberData, error: memberError } = await supabaseAdmin
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', req.user.id)
      .eq('status', 'active')
      .single();

    if (memberError || !memberData) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this organization',
        },
      });
    }

    // Fetch organization to ensure it exists and uses Footprint
    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, verification_provider')
      .eq('id', organizationId)
      .single();

    if (orgError || !orgData) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Organization not found',
        },
      });
    }

    // Ensure organization uses Footprint for verification
    if (orgData.verification_provider !== 'footprint') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_VERIFICATION_PROVIDER',
          message: 'This organization is not configured to use Footprint for verification',
        },
      });
    }

    // Create a user ID for this beneficial owner
    const beneficialOwnerId = `${organizationId}_owner_${ownerIndex}`;

    // Create user vault if it doesn't exist
    try {
      await footprintService.createUserVault(undefined, beneficialOwnerId);
    } catch (error) {
      // Ignore errors if the vault already exists
      console.log('Beneficial owner vault may already exist:', error);
    }

    // Generate the client token for beneficial owner information
    const tokenResponse = await footprintService.createClientToken({
      userId: beneficialOwnerId,
      fields,
      scope: 'vault',
      ttl: 3600, // 1 hour
    });

    // Return the token to the frontend
    return res.status(200).json({
      success: true,
      data: { token: tokenResponse.token },
    });
  } catch (error) {
    console.error('Error generating beneficial owner token:', error);
    return res.status(500).json(ApiError.internalServerError(error));
  }
}

export default withRateLimit(
  (req, res) => withAuthMiddleware(handler, { validateWallet: true })(req, res),
  'payment',
);
