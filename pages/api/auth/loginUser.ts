// pages/api/auth/loginUser.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { withRateLimit } from '../_middleware/rateLimiter';
import { userRepository } from '../_services/repositories/userRepository';
import * as privyService from '../_services/privyService';
import { ApiError } from '@/types/api/errors';
import { z } from 'zod';

// Login schema that requires only necessary fields
const loginSchema = z.object({
  auth_id: z.string(),
  email: z.string().email().optional(),
  wallet_address: z.string().optional(),
});

type LoginRequest = z.infer<typeof loginSchema>;

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json(ApiError.methodNotAllowed(req.method || 'unknown'));
  }

  try {
    // Validate request data
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid login data',
          details: result.error.format(),
        },
      });
    }

    const loginData = result.data;

    // Verify with Privy that this user exists
    try {
      const privyUser = await privyService.getUser(loginData.auth_id);
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

    // Check if user exists in our database
    const existingUser = await userRepository.getByAuthIdSystem(loginData.auth_id);

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not registered. Please sign up first.',
        },
      });
    }

    // Update last login time using admin client directly
    const updatedUser = await userRepository.update(existingUser.id, {
      last_sign_in: new Date().toISOString(),
    });

    return res.status(200).json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json(ApiError.internalServerError(error));
  }
}

// Use stricter rate limiting for auth endpoints
export default withRateLimit(handler, 'auth');
