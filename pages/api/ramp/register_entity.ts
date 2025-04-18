// pages/api/ramp/register_entity.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import * as zynkService from '../_services/zynkService';
import * as privyService from '../_services/privyService';
import { User } from '@privy-io/server-auth';

/**
 * Register a new business entity with Zynk
 *
 * This endpoint:
 * 1. Verifies the user via Privy (authentication only)
 * 2. Uses the business email from request body to check if an entity already exists
 * 3. Creates a new business entity if one doesn't exist
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

    // Verify the user (authentication only, not using their email)
    const claims = await privyService.verifyToken(authToken);

    // Extract required fields from request body
    const {
      type,
      firstName,
      lastName,
      email, // Business email from request, not from authenticated user
      phoneNumberPrefix,
      phoneNumber,
      nationality,
      dateOfBirth,
      permanentAddress,
    } = req.body;

    // Validate business email
    if (!email) {
      return res.status(400).json({
        error: 'Missing business email',
        message: 'A business email address is required for entity registration.',
      });
    }

    // Enforce business type only
    if (type && type !== 'business') {
      return res.status(400).json({
        error: 'Invalid entity type',
        message: 'Only business entities can be registered with this application.',
      });
    }

    // Check if entity already exists in Zynk by business email
    let entityId;
    try {
      const zynkEntity = await zynkService.getEntityByEmail(email);
      if (zynkEntity.success && zynkEntity.data.entity) {
        // Check if the existing entity is a business
        if (zynkEntity.data.entity.type !== 'business') {
          return res.status(400).json({
            error: 'Entity exists but is not a business',
            message:
              'An individual entity already exists with this email. Please contact support to convert it to a business entity.',
          });
        }

        entityId = zynkEntity.data.entity.entityId;

        // Entity already exists, return it
        return res.status(200).json({
          success: true,
          data: {
            entityId,
            message: 'Business entity already exists',
            entity: zynkEntity.data.entity,
          },
        });
      }
    } catch (error) {
      // Log error but continue (entity likely doesn't exist)
      console.log("Entity lookup error (expected if entity doesn't exist):", error);
    }

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

    // Create business entity in Zynk with business email from request
    const createResult = await zynkService.createEntity({
      type: 'business', // Always set to business regardless of what was provided
      firstName,
      lastName,
      email, // Using business email from request
      phoneNumberPrefix,
      phoneNumber,
      nationality,
      dateOfBirth,
      permanentAddress,
    });

    if (!createResult.success) {
      return res.status(400).json({
        error: 'Failed to create business entity in Zynk',
        details: createResult.data,
      });
    }

    entityId = createResult.data.entityId;

    // Return success response with entity ID
    return res.status(201).json({
      success: true,
      data: {
        entityId,
        message: 'Business entity created successfully',
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
