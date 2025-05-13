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

    // If form data was provided, update the organization first
    if (req.body.formData) {
      const formData = req.body.formData;

      // Extract organization fields
      const orgUpdateData: any = {};

      // Map form data fields to database fields
      if (formData['business.name']) orgUpdateData.name = formData['business.name'];
      if (formData['business.website']) orgUpdateData.website = formData['business.website'];
      if (formData['business.phone']) orgUpdateData.phone_number = formData['business.phone'];
      if (formData['business.email']) orgUpdateData.email = formData['business.email'];
      if (formData['business.description'])
        orgUpdateData.description = formData['business.description'];

      // Store other business fields as business_details JSON
      // Fixed: Properly parse business_details from JSON if needed and create a new object
      let businessDetails: Record<string, any> = {};

      // Parse existing business_details if it exists
      if (orgData.business_details) {
        try {
          // Handle if business_details is already an object or is a JSON string
          if (typeof orgData.business_details === 'object') {
            businessDetails = orgData.business_details as Record<string, any>;
          } else if (typeof orgData.business_details === 'string') {
            businessDetails = JSON.parse(orgData.business_details);
          }
        } catch (e) {
          console.error('Error parsing business_details:', e);
          // Continue with empty object if parsing fails
        }
      }

      // Update business details with new values
      if (formData['business.type']) businessDetails.type = formData['business.type'];
      if (formData['business.is_intermediary'] !== undefined)
        businessDetails.is_intermediary = formData['business.is_intermediary'];
      if (formData['business.countries_of_operation'])
        businessDetails.countries_of_operation = formData['business.countries_of_operation'];
      if (formData['business.countries_of_payment'])
        businessDetails.countries_of_payment = formData['business.countries_of_payment'];
      if (formData['business.currencies'])
        businessDetails.currencies = formData['business.currencies'];
      if (formData['business.source_of_funds'])
        businessDetails.source_of_funds = formData['business.source_of_funds'];
      if (formData['business.estimated_monthly_volume'])
        businessDetails.estimated_monthly_volume = formData['business.estimated_monthly_volume'];
      if (formData['business.estimated_annual_revenue'])
        businessDetails.estimated_annual_revenue = formData['business.estimated_annual_revenue'];

      // Update country-specific fields
      if (orgData.country === 'USA') {
        if (formData['business.registered_agent_address'])
          businessDetails.registered_agent_address = formData['business.registered_agent_address'];
        if (formData['business.mailing_address'])
          businessDetails.mailing_address = formData['business.mailing_address'];
      } else if (orgData.country === 'IND') {
        if (formData['business.gst_registration_number'])
          businessDetails.gst_registration_number = formData['business.gst_registration_number'];
        if (formData['business.pan_card_number'])
          businessDetails.pan_card_number = formData['business.pan_card_number'];
      } else if (orgData.country === 'CAN') {
        if (formData['business.registered_address'])
          businessDetails.registered_address = formData['business.registered_address'];
        if (formData['business.regulatory_fines'] !== undefined)
          businessDetails.regulatory_fines = formData['business.regulatory_fines'];
        if (formData['business.civil_litigation'] !== undefined)
          businessDetails.civil_litigation = formData['business.civil_litigation'];
        if (formData['business.bankruptcy'] !== undefined)
          businessDetails.bankruptcy = formData['business.bankruptcy'];
      }

      // Update business_details
      orgUpdateData.business_details = businessDetails;

      // Update verification status to in_progress
      orgUpdateData.verification_status = 'in_progress';

      // Update organization
      await supabaseAdmin.from('organizations').update(orgUpdateData).eq('id', id);
    }

    // Run KYB verification on the business using Footprint's headless KYB API
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
        ...(kybResponse.status === 'pass' ? { last_verified_at: new Date().toISOString() } : {}),
      })
      .eq('id', id);

    return res.status(200).json({
      success: true,
      data: {
        status: kybResponse.status,
        requires_manual_review: kybResponse.requires_manual_review,
        last_verified_at: kybResponse.status === 'pass' ? new Date().toISOString() : null,
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
