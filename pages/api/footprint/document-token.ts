// pages/api/footprint/document-token.ts
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
    const { organizationId, documentType, fields } = req.body;

    // Validate required parameters
    if (!organizationId || !documentType || !fields || !Array.isArray(fields)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message:
            'Missing required parameters: organizationId, documentType, and fields array are required',
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

    // Fetch organization to ensure it exists
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

    // Get or create Footprint business vault for this organization
    let footprintBusinessId = organizationId;

    // Generate the client token for document upload
    const tokenResponse = await footprintService.createClientToken({
      userId: footprintBusinessId,
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
    console.error('Error generating document token:', error);
    return res.status(500).json(ApiError.internalServerError(error));
  }
}

export default withRateLimit(
  (req, res) => withAuthMiddleware(handler, { validateWallet: true })(req, res),
  'payment',
);
