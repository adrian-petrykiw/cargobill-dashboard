// pages/api/footprint/validate-kyb.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuthMiddleware } from '../_middleware/withAuth';
import { withRateLimit } from '../_middleware/rateLimiter';
import { supabaseAdmin } from '../_config/supabase';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { validationToken, organizationId } = req.body;

    if (!validationToken || !organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Validation token and organization ID are required',
      });
    }

    const footprintAuthKey = process.env.FOOTPRINT_API_KEY;
    if (!footprintAuthKey) {
      console.error('FOOTPRINT_API_KEY not found');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error',
      });
    }

    // Validate the token with Footprint
    const footprintResponse = await fetch(
      'https://api.onefootprint.com/onboarding/session/validate',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(footprintAuthKey + ':').toString('base64')}`,
        },
        body: JSON.stringify({
          validation_token: validationToken,
        }),
      },
    );

    if (!footprintResponse.ok) {
      const errorData = await footprintResponse.json();
      console.error('Footprint validation failed:', errorData);
      return res.status(footprintResponse.status).json({
        success: false,
        error: 'Failed to validate verification',
        details: errorData,
      });
    }

    const validationData = await footprintResponse.json();

    // Check validation results
    const verificationStatus = validationData.business?.status === 'pass' ? 'verified' : 'pending';
    const requiresManualReview = validationData.business?.requires_manual_review === true;

    // Store Footprint business ID
    const footprintBusinessId = validationData.business?.fp_id;

    // Store the primary user's Footprint ID if available
    const ownerFootprintId = validationData.user?.fp_id;

    // Update organization in database with verification results
    const { error: updateError } = await supabaseAdmin
      .from('organizations')
      .update({
        verification_status: verificationStatus,
        last_verified_at: new Date().toISOString(),
        requires_manual_review: requiresManualReview,
        footprint_business_id: footprintBusinessId,
        owner_footprint_id: ownerFootprintId,
        verification_provider: 'footprint',
      })
      .eq('id', organizationId);

    if (updateError) {
      console.error('Error updating organization:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to update organization verification status',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        status: verificationStatus,
        requiresManualReview,
        footprintBusinessId,
      },
    });
  } catch (error) {
    console.error('Error validating KYB:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export default withRateLimit((req, res) => withAuthMiddleware(handler)(req, res), 'standard');
