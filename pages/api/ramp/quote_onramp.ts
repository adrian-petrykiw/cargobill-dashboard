// pages/api/ramp/quote_onramp.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import * as zynkService from '../_services/zynkService';
import * as privyService from '../_services/privyService';

/**
 * Get an onramp quote for a business entity
 *
 * This endpoint:
 * 1. Verifies the user via Privy (authentication only)
 * 2. Fetches the entity by ID from the request
 * 3. Gets jurisdictions to determine available onramp options
 * 4. Returns the necessary data to continue the onramp process
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const headerAuthToken = req.headers.authorization?.replace(/^Bearer /, '');
    const cookieAuthToken = req.cookies['privy-token'];
    const authToken = cookieAuthToken || headerAuthToken;

    if (!authToken) {
      return res.status(401).json({ error: 'Missing authentication token' });
    }

    await privyService.verifyToken(authToken);

    const { entityId: requestEntityId, businessEmail } = req.body;

    let entityId = requestEntityId;

    if (!entityId && !businessEmail) {
      return res.status(400).json({
        error: 'Missing entity identification',
        message: 'Either entityId or businessEmail must be provided to get an onramp quote.',
      });
    }

    // If entityId is not provided but businessEmail is, try to get the entity by email
    if (!entityId && businessEmail) {
      try {
        const zynkEntity = await zynkService.getEntityByEmail(businessEmail);
        if (zynkEntity.success && zynkEntity.data.entity) {
          entityId = zynkEntity.data.entity.entityId;
        } else {
          return res.status(404).json({
            error: 'Entity not found with provided email',
            message: 'No entity found with the provided business email. Please register first.',
          });
        }
      } catch (error) {
        console.error('Error looking up entity by email:', error);
        return res.status(404).json({
          error: 'Entity not registered with Zynk',
          message: 'Please register your business information before requesting an onramp quote.',
        });
      }
    }

    // Verify entity exists by ID
    try {
      const entityResult = await zynkService.getEntityById(entityId);
      if (!entityResult.success) {
        return res.status(404).json({
          error: 'Entity not found',
          message: 'The specified entity could not be found. Please register first.',
        });
      }

      // Check if the entity is a business
      if (entityResult.data.entity.type !== 'business') {
        return res.status(400).json({
          error: 'Entity is not a business',
          message: 'Only business entities can request onramp quotes in this application.',
        });
      }
    } catch (error) {
      console.error('Error verifying entity:', error);
      return res.status(500).json({
        error: 'Failed to verify entity',
        message: 'Unable to verify the specified entity.',
      });
    }

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
