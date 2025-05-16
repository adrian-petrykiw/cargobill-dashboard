// pages/api/organizations/[id]/data.ts
import type { NextApiResponse } from 'next';
import { withAuthMiddleware } from '../../_middleware/withAuth';
import { AuthenticatedRequest } from '@/types/api/requests';
import { withRateLimit } from '../../_middleware/rateLimiter';
import { footprintService } from '../../_services/footprintService';
import { ApiError } from '@/types/api/errors';
import { supabaseAdmin } from '../../_config/supabase';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(ApiError.methodNotAllowed(req.method || 'unknown'));
  }

  try {
    const organizationId = req.query.id as string;

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

    // Fetch organization data from Supabase
    const { data: organization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single();

    if (orgError || !organization) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Organization not found',
        },
      });
    }

    let businessEmail = '';
    if (
      organization.business_details &&
      typeof organization.business_details === 'object' &&
      organization.business_details !== null &&
      'email' in organization.business_details
    ) {
      businessEmail = (organization.business_details.email as string) || '';
    }

    // If organization is not verified, don't return sensitive data
    if (organization.verification_status !== 'verified') {
      return res.status(200).json({
        success: true,
        data: {
          id: organization.id,
          name: organization.name,
          country: organization.country,
          email: businessEmail,
          verification_status: organization.verification_status,
        },
      });
    }

    const footprintBusinessId = organization.data_vault_id;

    if (!footprintBusinessId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FOOTPRINT_ID',
          message: 'Organization does not have a Footprint business ID',
        },
      });
    }

    // Try to get business data from Footprint
    let businessData = {};
    let documentTypes: string[] = [];

    try {
      // Use the simplified getBusinessData method
      businessData = await footprintService.getBusinessData(
        footprintBusinessId,
        `Organization details view by ${req.user.id}`,
      );
    } catch (error) {
      console.error('Failed to get business data:', error);
      // We'll continue with empty business data
    }

    try {
      // Try to get document types
      documentTypes = await footprintService.getBusinessDocumentTypes(footprintBusinessId);
    } catch (error) {
      console.error('Failed to get document types:', error);
      // We'll continue with empty document types
    }

    // Even if both fail, still return what we have
    return res.status(200).json({
      success: true,
      data: {
        ...organization,
        business_data: businessData || {},
        available_documents: documentTypes || [],
      },
    });
  } catch (error) {
    console.error('Error retrieving organization data:', error);
    return res.status(500).json(ApiError.internalServerError(error));
  }
}

export default withRateLimit((req, res) => withAuthMiddleware(handler)(req, res), 'standard');
