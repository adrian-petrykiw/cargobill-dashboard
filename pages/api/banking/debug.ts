// pages/api/banking/debug.ts
import { NextApiResponse } from 'next';
import { withAuthMiddleware } from '../_middleware/withAuth';
import { AuthenticatedRequest } from '@/types/api/requests';
import { organizationRepository } from '../_services/repositories/organizationRepository';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== BANKING DEBUG ENDPOINT ===');
    console.log('User ID:', req.user.id);
    console.log('User data:', req.user);

    // Check environment variables
    const envCheck = {
      BANKING_API_KEY: !!process.env.BANKING_API_KEY,
      BANKING_API_URL: !!process.env.BANKING_API_URL,
      BANKING_CUSTOMER_ID: !!process.env.BANKING_CUSTOMER_ID,
      BANKING_API_URL_VALUE: process.env.BANKING_API_URL,
      BANKING_CUSTOMER_ID_VALUE: process.env.BANKING_CUSTOMER_ID,
    };
    console.log('Environment variables:', envCheck);

    // Check organizations
    let organizations = null;
    let orgError = null;
    try {
      organizations = await organizationRepository.getByUserId(req.user.id);
      console.log('Organizations found:', organizations?.length || 0);
      console.log('Organizations data:', organizations);
    } catch (error) {
      orgError = error;
      console.error('Organization fetch error:', error);
    }

    const debugData = {
      user: {
        id: req.user.id,
      },
      environment: envCheck,
      organizationsFound: {
        count: organizations?.length || 0,
        data: organizations,
        error: orgError ? (orgError instanceof Error ? orgError.message : String(orgError)) : null,
      },
      fboAccounts:
        organizations?.map((org) => ({
          orgId: org.id,
          orgName: org.name,
          fboAccountId: org.fbo_account_id,
          hasFboAccount: !!org.fbo_account_id,
        })) || [],
    };

    return res.status(200).json({
      success: true,
      debug: debugData,
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export default withAuthMiddleware(handler);
