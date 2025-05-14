// pages/api/users/exists.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { withRateLimit } from '../_middleware/rateLimiter';
import { ApiError } from '@/types/api/errors';
import { supabaseService } from '../_services/supabaseService';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json(ApiError.methodNotAllowed(req.method || 'unknown'));
  }

  const { auth_id, email } = req.body;

  if (!auth_id || !email) {
    return res.status(400).json(ApiError.validation('Both auth_id and email are required'));
  }

  try {
    // Get user by auth_id only, using the existing method
    const user = await supabaseService.users.getByAuthIdSystem(auth_id);

    // If user exists, verify the email matches for additional security
    const exists = !!user && user.email === email;

    return res.status(200).json({
      success: true,
      data: { exists },
    });
  } catch (error: any) {
    console.error('Error checking user existence:', error);

    // More detailed error logging
    if (error.code) {
      console.error(`Database error code: ${error.code}, message: ${error.message}`);
    }

    // Always return a 200 with exists: false rather than a 500 for authentication flows
    // This prevents exposing internal errors to clients while maintaining a consistent API
    return res.status(200).json({
      success: true,
      data: { exists: false },
    });
  }
}

export default withRateLimit(handler, 'auth');
