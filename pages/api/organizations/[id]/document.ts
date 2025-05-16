// pages/api/organizations/[id]/document.ts
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
    const documentType = req.query.type as string;

    if (!documentType) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_DOCUMENT_TYPE',
          message: 'Document type is required',
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

    // If organization is not verified, don't return documents
    if (organization.verification_status !== 'verified') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ORGANIZATION_NOT_VERIFIED',
          message: 'Organization is not verified',
        },
      });
    }

    // Get Footprint business ID
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

    // Get document using vault proxy
    const documentData = await footprintService.getBusinessDocument(
      footprintBusinessId,
      documentType,
      `Document download by ${req.user.id}`,
    );

    // Set response headers for PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${documentType}.pdf"`);

    // Return the document data
    return res.send(documentData);
  } catch (error) {
    console.error('Error retrieving organization document:', error);
    return res.status(500).json(ApiError.internalServerError(error));
  }
}

export default withRateLimit((req, res) => withAuthMiddleware(handler)(req, res), 'standard');
