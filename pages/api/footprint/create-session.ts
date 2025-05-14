// pages/api/footprint/create-session.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuthMiddleware } from '../_middleware/withAuth';
import { withRateLimit } from '../_middleware/rateLimiter';
import { supabaseAdmin } from '../_config/supabase';
import { convertToAlpha2 } from '@/lib/helpers/countryCodeUtils';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { organizationId, organizationCountry } = req.body;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    if (!organizationCountry) {
      return res.status(400).json({ error: 'Organization country is required' });
    }

    // Get organization data from Supabase
    const { data: organization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single();

    if (orgError) {
      console.error('Error fetching organization:', orgError);
      return res.status(500).json({ error: 'Failed to fetch organization data' });
    }

    // Safely extract email from business_details JSONB
    let businessEmail = '';
    if (
      organization.business_details &&
      typeof organization.business_details === 'object' &&
      organization.business_details !== null &&
      'email' in organization.business_details
    ) {
      businessEmail = (organization.business_details.email as string) || '';
    }

    // Create an onboarding session with Footprint
    const playbookKey = process.env.FOOTPRINT_KYB_PLAYBOOK_KEY;

    if (!playbookKey) {
      console.error('FOOTPRINT_KYB_PLAYBOOK_KEY not found');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Convert the 3-letter country code to 2-letter for Footprint
    const alpha2CountryCode = convertToAlpha2(organizationCountry);

    if (!alpha2CountryCode) {
      console.error(`Invalid country code: ${organizationCountry}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid country code. Please provide a valid country.',
      });
    }

    const bootstrapData: Record<string, string> = {
      'business.name': organization.name,
      'business.country': alpha2CountryCode,
    };

    // Only add email if it exists
    if (businessEmail) {
      bootstrapData['id.email'] = businessEmail;
    }

    const footprintAuthKey = process.env.FOOTPRINT_API_KEY;

    if (!footprintAuthKey) {
      console.error('FOOTPRINT_API_KEY not found');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    console.log('Sending request to Footprint with country code:', alpha2CountryCode);

    const footprintResponse = await fetch('https://api.onefootprint.com/onboarding/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(footprintAuthKey + ':').toString('base64')}`,
      },
      body: JSON.stringify({
        kind: 'onboard',
        key: playbookKey,
        business_external_id: organizationId,
        bootstrap_data: bootstrapData,
      }),
    });

    if (!footprintResponse.ok) {
      const errorData = await footprintResponse.json();
      console.error('Footprint session creation failed:', errorData);
      return res.status(footprintResponse.status).json({
        success: false,
        error: 'Failed to create verification session',
        details: errorData,
      });
    }

    const sessionData = await footprintResponse.json();

    return res.status(200).json({ success: true, data: { token: sessionData.token } });
  } catch (error) {
    console.error('Error creating footprint session:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

export default withRateLimit((req, res) => withAuthMiddleware(handler)(req, res), 'standard');
