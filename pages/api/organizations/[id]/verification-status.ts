// pages/api/organizations/[id]/verification-status.ts
import type { NextApiResponse } from 'next';
import { withAuthMiddleware } from '../../_middleware/withAuth';
import { ApiError } from '@/types/api/errors';
import { AuthenticatedRequest } from '@/types/api/requests';
import { withRateLimit } from '../../_middleware/rateLimiter';
import { supabaseAdmin } from '../../_config/supabase';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(ApiError.methodNotAllowed(req.method || 'unknown'));
  }

  const { id } = req.query;
  if (!id || Array.isArray(id)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_PARAMETER',
        message: 'Invalid organization ID',
      },
    });
  }

  try {
    // Check if user is a member of the specified organization
    const { data: memberData, error: memberError } = await supabaseAdmin
      .from('organization_members')
      .select('id')
      .eq('organization_id', id)
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

    // Fetch organization details
    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('id', id)
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

    // Return verification status information
    // Use type assertion to avoid TypeScript error
    const verificationDetails = (orgData as any).verification_details || null;

    return res.status(200).json({
      success: true,
      data: {
        status: orgData.verification_status || 'none',
        last_verified_at: orgData.last_verified_at || null,
        verification_provider: orgData.verification_provider || null,
        verification_details: verificationDetails,
      },
    });
  } catch (error) {
    console.error('Error getting verification status:', error);
    return res.status(500).json(ApiError.internalServerError(error));
  }
}

export default withRateLimit(
  (req, res) => withAuthMiddleware(handler, { validateWallet: true })(req, res),
  'standard',
);
