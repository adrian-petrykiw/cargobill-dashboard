// pages/api/ramp/quote_onramp.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import * as zynkService from '../_services/zynkService';
import * as privyService from '../_services/privyService';
import { User } from '@privy-io/server-auth';

/**
 * Get an onramp quote for a user
 *
 * This endpoint:
 * 1. Verifies the user via Privy
 * 2. Fetches the entity in Zynk (returns error if not found)
 * 3. Gets jurisdictions to determine available onramp options
 * 4. Returns the necessary data to continue the onramp process
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract auth token from request
    const headerAuthToken = req.headers.authorization?.replace(/^Bearer /, '');
    const cookieAuthToken = req.cookies['privy-token'];
    const authToken = cookieAuthToken || headerAuthToken;

    if (!authToken) {
      return res.status(401).json({ error: 'Missing authentication token' });
    }

    // Verify the user
    const claims = await privyService.verifyToken(authToken);
    const userId = claims.userId;

    // Get user data from Privy
    const privyUser: User = await privyService.getUser(userId);

    // Check if entity already exists in Zynk by email
    let entityId;

    // Ensure email exists before trying to access it
    if (!privyUser.email?.address) {
      return res.status(400).json({
        error: 'User does not have a verified email address',
        message: 'Please link an email address to your account before proceeding.',
      });
    }

    try {
      const zynkEntity = await zynkService.getEntityByEmail(privyUser.email.address);
      if (zynkEntity.success && zynkEntity.data.entity) {
        entityId = zynkEntity.data.entity.entityId;
      }
    } catch (error) {
      // Entity doesn't exist
      return res.status(404).json({
        error: 'Entity not registered with Zynk',
        message: 'Please register your business information before requesting an onramp quote.',
      });
    }

    // If we still don't have an entityId, return an error
    if (!entityId) {
      return res.status(404).json({
        error: 'Entity not found',
        message: 'Please register your business information before requesting an onramp quote.',
      });
    }

    // Get available jurisdictions for onramping
    const jurisdictionsResult = await zynkService.getJurisdictions();

    if (!jurisdictionsResult.success) {
      return res.status(500).json({
        error: 'Failed to fetch jurisdictions',
        details: jurisdictionsResult.data,
      });
    }

    // Filter for active jurisdictions only
    const activeJurisdictions = jurisdictionsResult.data.filter(
      (jurisdiction: any) => jurisdiction.isActive,
    );

    // Return data needed for the next step in onramp process
    return res.status(200).json({
      success: true,
      data: {
        entityId,
        jurisdictions: activeJurisdictions,
        nextStep: 'select_jurisdiction_and_amount',
      },
    });
  } catch (error: any) {
    console.error('Onramp quote error:', error);

    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred',
    });
  }
}
