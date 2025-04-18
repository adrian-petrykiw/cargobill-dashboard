// pages/api/ramp/register_entity.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import * as zynkService from '../_services/zynkService';
import * as privyService from '../_services/privyService';
import { User } from '@privy-io/server-auth';

/**
 * Register a new entity with Zynk
 *
 * This endpoint:
 * 1. Verifies the user via Privy
 * 2. Checks if an entity already exists for this user
 * 3. Creates a new entity if one doesn't exist
 * 4. Returns the entity ID
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

    // Ensure email exists before trying to access it
    if (!privyUser.email?.address) {
      return res.status(400).json({
        error: 'User does not have a verified email address',
        message: 'Please link an email address to your account before registering an entity.',
      });
    }

    // Check if entity already exists in Zynk by email
    let entityId;

    try {
      const zynkEntity = await zynkService.getEntityByEmail(privyUser.email.address);
      if (zynkEntity.success && zynkEntity.data.entity) {
        entityId = zynkEntity.data.entity.entityId;

        // Entity already exists, return it
        return res.status(200).json({
          success: true,
          data: {
            entityId,
            message: 'Entity already exists',
            entity: zynkEntity.data.entity,
          },
        });
      }
    } catch (error) {
      // Entity doesn't exist, we'll create it
    }

    // Extract required fields from request body
    const {
      type = 'individual', // Default to individual if not specified
      firstName,
      lastName,
      phoneNumberPrefix,
      phoneNumber,
      nationality,
      dateOfBirth,
      permanentAddress,
    } = req.body;

    // Validate required fields
    if (
      !firstName ||
      !lastName ||
      !phoneNumberPrefix ||
      !phoneNumber ||
      !nationality ||
      !dateOfBirth ||
      !permanentAddress
    ) {
      return res.status(400).json({
        error: 'Missing required fields',
        requiredFields: [
          'firstName',
          'lastName',
          'phoneNumberPrefix',
          'phoneNumber',
          'nationality',
          'dateOfBirth',
          'permanentAddress',
        ],
      });
    }

    // Validate permanent address fields
    const requiredAddressFields = [
      'addressLine1',
      'locality',
      'city',
      'state',
      'country',
      'postalCode',
    ];

    const missingAddressFields = requiredAddressFields.filter((field) => !permanentAddress[field]);

    if (missingAddressFields.length > 0) {
      return res.status(400).json({
        error: 'Missing required address fields',
        requiredFields: missingAddressFields,
      });
    }

    // Create entity in Zynk
    const createResult = await zynkService.createEntity({
      type,
      firstName,
      lastName,
      email: privyUser.email.address,
      phoneNumberPrefix,
      phoneNumber,
      nationality,
      dateOfBirth,
      permanentAddress,
    });

    if (!createResult.success) {
      return res.status(400).json({
        error: 'Failed to create entity in Zynk',
        details: createResult.data,
      });
    }

    entityId = createResult.data.entityId;

    // Return success response with entity ID
    return res.status(201).json({
      success: true,
      data: {
        entityId,
        message: 'Entity created successfully',
      },
    });
  } catch (error: any) {
    console.error('Entity registration error:', error);

    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred',
    });
  }
}
