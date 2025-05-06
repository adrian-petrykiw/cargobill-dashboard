// pages/api/users/registerUser.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { withRateLimit } from '../_middleware/rateLimiter';
import { userRepository } from '../_services/repositories/userRepository';
import * as privyService from '../_services/privyService';
import { ApiError } from '@/types/api/errors';
import { createUserSchema } from '@/schemas/user.schema';
import { createSupabaseClient } from '../_config/supabase';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json(ApiError.methodNotAllowed(req.method || 'unknown'));
  }

  try {
    // Validate request data with existing createUserSchema
    const result = createUserSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid registration data',
          details: result.error.format(),
        },
      });
    }

    const userData = result.data;

    // Verify with Privy that this user exists
    try {
      const privyUser = await privyService.getUser(userData.auth_id);
      if (!privyUser) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_ERROR',
            message: 'Invalid authentication credentials',
          },
        });
      }
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Failed to verify authentication',
        },
      });
    }

    // Check if user already exists
    const existingUser = await userRepository.getByAuthIdSystem(userData.auth_id);

    let user;
    if (existingUser) {
      // Create authenticated context for the update
      const supabase = createSupabaseClient();
      supabase.rpc('set_claim', {
        claim: 'user_id',
        value: existingUser.id,
      });

      // Update existing user with any new information
      user = await userRepository.update(supabase, existingUser.id, userData);
    } else {
      // Create new user (uses admin privileges)
      user = await userRepository.create(userData);
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json(ApiError.internalServerError(error));
  }
}

export default withRateLimit(handler, 'auth');
