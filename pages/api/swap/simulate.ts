// pages/api/swap/simulate.ts
import { NextApiResponse } from 'next';
import { withAuthMiddleware } from '../_middleware/withAuth';
import { withRateLimit } from '../_middleware/rateLimiter';
import { organizationRepository } from '../_services/repositories/organizationRepository';
import { stableswapService, StableswapServiceError } from '../_services/stableswapService';
import { ApiError } from '@/types/api/errors';
import { AuthenticatedRequest } from '@/types/api/requests';
import { z } from 'zod';

// Validation schema for swap simulation request
const swapSimulationSchema = z
  .object({
    organizationId: z.string().min(1, 'Organization ID is required'),
    fromToken: z.enum(['USDC', 'USDT', 'EURC'] as const),
    toToken: z.enum(['USDC', 'USDT', 'EURC'] as const),
    amount: z.number().positive('Amount must be positive'),
    slippageTolerance: z.number().min(0.1).max(5).default(0.5),
  })
  .refine((data) => data.fromToken !== data.toToken, {
    message: 'From and to tokens must be different',
  });

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json(ApiError.methodNotAllowed(req.method || 'unknown'));
  }

  try {
    // Validate request body
    const result = swapSimulationSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid swap simulation data',
          details: result.error.format(),
        },
      });
    }

    const { organizationId, fromToken, toToken, amount, slippageTolerance } = result.data;

    console.log(
      `Processing swap simulation for organization: ${organizationId}, ${amount} ${fromToken} -> ${toToken}`,
    );

    // Verify organization exists and user has access
    let organization;
    try {
      organization = await organizationRepository.getById(organizationId);

      // Verify user belongs to this organization
      const userOrganizations = await organizationRepository.getByUserId(req.user.id);
      const hasAccess = userOrganizations.some((org) => org.id === organizationId);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have access to this organization',
          },
        });
      }

      if (!organization.operational_wallet?.address) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MULTISIG_NOT_CONFIGURED',
            message: 'Organization multisig wallet not configured',
          },
        });
      }
    } catch (error) {
      console.error('Failed to get organization for swap simulation:', error);
      return res.status(404).json({
        success: false,
        error: {
          code: 'ORGANIZATION_NOT_FOUND',
          message: 'Organization not found',
        },
      });
    }

    // Simulate the swap using the stableswap service - return directly without caching
    try {
      const simulationResult = await stableswapService.simulateSwap({
        multisigAddress: organization.operational_wallet.address,
        fromToken,
        toToken,
        amount,
        slippageTolerance,
      });

      console.log('Simulation completed successfully:', {
        route: simulationResult.route,
        amountIn: simulationResult.amountIn,
        estimatedAmountOut: simulationResult.estimatedAmountOut,
        priceImpact: simulationResult.priceImpact,
      });

      return res.status(200).json({
        success: true,
        data: simulationResult,
      });
    } catch (error) {
      console.error('Failed to simulate swap:', error);

      if (error instanceof StableswapServiceError) {
        let statusCode = 500;

        if (error.code.includes('INSUFFICIENT_BALANCE')) {
          statusCode = 400;
        } else if (error.code.includes('INVALID')) {
          statusCode = 400;
        } else if (error.code.includes('SLIPPAGE_TOO_HIGH')) {
          statusCode = 400;
        } else if (error.code.includes('UNSUPPORTED')) {
          statusCode = 400;
        } else if (error.code.includes('BALANCE_CHECK_FAILED')) {
          statusCode = 500;
        }

        return res.status(statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        });
      }

      return res.status(500).json({
        success: false,
        error: {
          code: 'SWAP_SIMULATION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to simulate swap',
        },
      });
    }
  } catch (error) {
    console.error('Unexpected error in swap simulation endpoint:', error);
    return res.status(500).json(ApiError.internalServerError(error));
  }
}

export default withRateLimit(
  (req, res) => withAuthMiddleware(handler, { validateWallet: false })(req, res),
  'standard',
);
