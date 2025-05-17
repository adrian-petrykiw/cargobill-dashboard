// pages/api/footprint/create-entity.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuthMiddleware } from '../_middleware/withAuth';
import { withRateLimit } from '../_middleware/rateLimiter';
import { supabaseAdmin } from '../_config/supabase';
import { footprintService } from '../_services/footprintService';
import zynkService from '../_services/zynkService';
import { convertToAlpha2 } from '@/lib/helpers/countryCodeUtils';
import { CreateEntityParams } from '@/types/zynk';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { organizationId } = req.body;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Organization ID is required',
      });
    }

    // Get organization data
    const { data: organization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single();

    if (orgError || !organization) {
      console.error('Error fetching organization:', orgError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch organization data',
      });
    }

    // Check if organization already has a ramping entity ID
    if (organization.ramping_entity_id) {
      return res.status(200).json({
        success: true,
        message: 'Organization already has a Zynk entity',
        data: {
          entityId: organization.ramping_entity_id,
        },
      });
    }

    // Type safety for business_details
    interface BusinessDetails {
      email?: string;
      phone?: string;
      website?: string;
    }

    // Parse business details with type safety
    const businessDetails = (organization.business_details || {}) as BusinessDetails;

    // Initialize default values for email and phone
    let businessEmail = '';
    let businessPhone = '';

    // Extract address information from Footprint if available
    let addressData = {
      addressLine1: '',
      addressLine2: '',
      locality: '',
      city: '',
      state: '',
      postalCode: '',
    };

    // Only try to fetch data from Footprint if data_vault_id exists
    if (organization.data_vault_id) {
      try {
        const footprintBusinessData = await footprintService.getBusinessData(
          organization.data_vault_id,
          'Create Zynk Entity',
        );

        // Get email and phone from Footprint if available
        businessEmail = footprintBusinessData.email || businessDetails.email || '';
        businessPhone = footprintBusinessData.phone || businessDetails.phone || '';

        // Map Footprint data to our address structure
        addressData = {
          addressLine1: footprintBusinessData.address_line1 || '',
          addressLine2: footprintBusinessData.address_line2 || '',
          locality: '', // Locality doesn't exist for US businesses
          city: footprintBusinessData.city || '',
          state: footprintBusinessData.state || '',
          postalCode: footprintBusinessData.zip || '',
        };

        // Update the organization's business_details in Supabase
        if (businessEmail || businessPhone) {
          await supabaseAdmin
            .from('organizations')
            .update({
              business_details: {
                ...businessDetails,
                email: businessEmail,
                phone: businessPhone,
                website: businessDetails.website || '',
              },
            })
            .eq('id', organizationId);
        }
      } catch (error) {
        console.warn('Error fetching data from Footprint, proceeding with limited data:', error);
        // Fall back to database values if Footprint fails
        businessEmail = businessDetails.email || '';
        businessPhone = businessDetails.phone || '';
      }
    } else {
      // No Footprint ID, use business details from database
      businessEmail = businessDetails.email || '';
      businessPhone = businessDetails.phone || '';
    }

    // Get the country code
    const country = organization.country || 'USA';
    const alpha2Country = convertToAlpha2(country);

    // Prepare phone number data
    // Default to US phone format if empty
    const phoneNumberPrefix = businessPhone.startsWith('+') ? businessPhone.substring(1, 3) : '1';

    const phoneNumber = businessPhone.replace(/\D/g, '');
    const formattedPhoneNumber =
      phoneNumber.length > 0 ? phoneNumber.slice(-10).padStart(10, '0') : '0000000000';

    // Prepare data for Zynk entity creation with explicit typing
    const entityData: CreateEntityParams = {
      type: 'business' as 'business', // Type assertion to match the expected literal type
      firstName: organization.name, // Default for business entity
      lastName: '', // Empty for business entity
      email: businessEmail,
      phoneNumberPrefix: phoneNumberPrefix,
      phoneNumber: formattedPhoneNumber,
      nationality: alpha2Country,
      dateOfBirth: '2000-01-01', // January 1, 2000 for all business entities
      permanentAddress: {
        addressLine1: addressData.addressLine1,
        addressLine2: addressData.addressLine2,
        locality: ' ', // Space character for US businesses
        city: addressData.city,
        state: addressData.state,
        country: alpha2Country,
        postalCode: addressData.postalCode,
      },
    };

    // Create entity in Zynk
    const zynkResult = await zynkService.createEntity(entityData);

    if (!zynkResult || !zynkResult.data || !zynkResult.data.entityId) {
      console.error('Failed to create Zynk entity:', zynkResult);
      return res.status(500).json({
        success: false,
        error: 'Failed to create Zynk entity',
        details: zynkResult,
      });
    }

    const rampingEntityId = zynkResult.data.entityId;

    // Update organization with the Zynk entity ID
    const { error: updateError } = await supabaseAdmin
      .from('organizations')
      .update({
        ramping_entity_id: rampingEntityId,
      })
      .eq('id', organizationId);

    if (updateError) {
      console.error('Error updating organization with Zynk entity ID:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to update organization with Zynk entity ID',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        entityId: rampingEntityId,
        message: 'Zynk entity created successfully',
      },
    });
  } catch (error) {
    console.error('Error creating Zynk entity:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export default withRateLimit((req, res) => withAuthMiddleware(handler)(req, res), 'standard');
