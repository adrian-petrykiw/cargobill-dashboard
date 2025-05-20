// pages/api/vendors/index.ts
import type { NextApiResponse } from 'next';
import { withAuthMiddleware } from '../_middleware/withAuth';
import { supabaseAdmin } from '../_config/supabase';
import { ApiError } from '@/types/api/errors';
import { AuthenticatedRequest } from '@/types/api/requests';
import { withRateLimit } from '../_middleware/rateLimiter';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(ApiError.methodNotAllowed(req.method || 'unknown'));
  }

  if (!req.user?.id) {
    console.error('No user ID in request');
    return res.status(401).json(ApiError.unauthorized());
  }

  try {
    console.log('Fetching organizations for user:', req.user.id);

    // Get filtered organizations, excluding those created by this user
    const { data: orgs, error: orgsError } = await supabaseAdmin
      .from('organizations')
      .select(
        `
        id,
        name,
        business_details,
        created_by,
        operational_wallet
      `,
      )
      .neq('created_by', req.user.id)
      .not('operational_wallet', 'is', null)
      .order('created_at', { ascending: false });

    if (orgsError) {
      console.error('Database error:', orgsError);
      throw orgsError;
    }

    console.log('Found organizations:', orgs?.length || 0);

    if (!orgs) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    // Filter out organizations with non-active operational wallets
    const vendors = orgs
      .filter((org) => {
        // Safely check if operational_wallet exists and has active status
        const wallet = org.operational_wallet as any;
        return wallet && typeof wallet === 'object' && wallet.status === 'active';
      })
      .map((org) => ({
        id: org.id,
        name: org.name || 'Unknown Company',
      }));

    return res.status(200).json({
      success: true,
      data: vendors,
    });
  } catch (error) {
    console.error('Error in vendor listing:', error);
    return res.status(500).json({
      success: false,
      error: {
        error: 'Failed to fetch vendors',
        code: 'FETCH_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

export default withRateLimit(
  (req, res) => withAuthMiddleware(handler, { validateWallet: true })(req, res),
  'standard',
);
