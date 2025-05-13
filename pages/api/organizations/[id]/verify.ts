// pages/api/organizations/[id]/verify.ts
import type { NextApiResponse } from 'next';
import { withAuthMiddleware } from '../../_middleware/withAuth';
import { AuthenticatedRequest } from '@/types/api/requests';
import { withRateLimit } from '../../_middleware/rateLimiter';
import { footprintService } from '../../_services/footprintService';
import { ApiError } from '@/types/api/errors';
import { supabaseAdmin } from '../../_config/supabase';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
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

    // Run KYB verification on the business
    // Using Footprint's headless KYB API
    const kybResponse = await footprintService.runKybVerification({
      businessId: id,
      playbookKey: process.env.FOOTPRINT_KYB_PLAYBOOK_KEY || '',
      allowReonboard: true,
    });

    // Update organization verification status
    await supabaseAdmin
      .from('organizations')
      .update({
        verification_status:
          kybResponse.status === 'pass'
            ? 'verified'
            : kybResponse.status === 'fail'
              ? 'rejected'
              : kybResponse.requires_manual_review
                ? 'pending_review'
                : 'pending',
        verification_details: {
          provider: 'footprint',
          status: kybResponse.status,
          requires_manual_review: kybResponse.requires_manual_review,
          onboarding_id: kybResponse.onboarding_id,
          timestamp: new Date().toISOString(),
        },
      })
      .eq('id', id);

    return res.status(200).json({
      success: true,
      data: {
        status: kybResponse.status,
        requires_manual_review: kybResponse.requires_manual_review,
      },
    });
  } catch (error) {
    console.error('Error initiating verification:', error);
    return res.status(500).json(ApiError.internalServerError(error));
  }
}

export default withRateLimit(
  (req, res) => withAuthMiddleware(handler, { validateWallet: true })(req, res),
  'payment',
);
