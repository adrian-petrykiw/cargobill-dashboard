// pages/api/organizations/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuthMiddleware } from '../_middleware/withAuth';
import { supabaseService } from '../_services/supabaseService';
import { createOrganizationSchema } from '@/schemas/organization.schema';
import { ApiResponse } from '@/types/api/responses';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { user } = req as any; // User added by middleware

  try {
    if (req.method === 'GET') {
      const organizations = await supabaseService.organizations.getByUserId(user.id);
      return res.status(200).json({
        success: true,
        data: organizations,
      });
    }

    if (req.method === 'POST') {
      try {
        // Validate request body with Zod
        const result = createOrganizationSchema.safeParse(req.body);

        if (!result.success) {
          return res.status(400).json({
            success: false,
            error: {
              message: 'Invalid organization data',
              details: result.error.format(),
            },
          });
        }

        const newOrg = await supabaseService.organizations.create(result.data, user.id);

        return res.status(201).json({
          success: true,
          data: newOrg,
        });
      } catch (error) {
        console.error('Failed to create organization:', error);
        return res.status(500).json({
          success: false,
          error: {
            message: 'Failed to create organization',
            details: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }

    // Method not allowed
    return res.status(405).json({
      success: false,
      error: {
        message: `Method ${req.method} not allowed`,
      },
    });
  } catch (error) {
    console.error('Organization API error:', error);
    return res.status(500).json({
      success: false,
      error: {
        message: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

export default withAuthMiddleware(handler);
