// pages/api/footprint/client-token.ts
import type { NextApiResponse } from 'next';
import { withAuthMiddleware } from '../_middleware/withAuth';
import { AuthenticatedRequest } from '@/types/api/requests';
import { withRateLimit } from '../_middleware/rateLimiter';
import { footprintService } from '../_services/footprintService';
import { ApiError } from '@/types/api/errors';
import { supabaseAdmin } from '../_config/supabase';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json(ApiError.methodNotAllowed(req.method || 'unknown'));
  }

  try {
    const { organizationId, fields, scope = 'vault', ttl = 1800 } = req.body;

    if (!organizationId || !fields || !Array.isArray(fields)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required parameters: organizationId and fields array are required',
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

    // Generate the client token using the organization ID as the business ID
    const tokenResponse = await footprintService.createClientToken({
      userId: organizationId, // Use organization ID directly as the business ID in Footprint
      fields,
      scope,
      ttl,
    });

    return res.status(200).json({
      success: true,
      data: { token: tokenResponse.token },
    });
  } catch (error) {
    console.error('Error generating client token:', error);
    return res.status(500).json(ApiError.internalServerError(error));
  }
}

export default withRateLimit(
  (req, res) => withAuthMiddleware(handler, { validateWallet: true })(req, res),
  'payment',
);
