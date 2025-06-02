// pages/api/swap/finalize.ts
import { NextApiResponse } from 'next';
import { withAuthMiddleware } from '../_middleware/withAuth';
import { withRateLimit } from '../_middleware/rateLimiter';
import { stableswapService, StableswapServiceError } from '../_services/stableswapService';
import { ApiError } from '@/types/api/errors';
import { AuthenticatedRequest } from '@/types/api/requests';
import { z } from 'zod';
import { getExecutionContext, deleteExecutionContext } from './prepare';

// Validation schema for swap finalization request
const swapFinalizationSchema = z.object({
  serializedSignedExecutionTransaction: z
    .string()
    .min(1, 'Signed execution transaction is required'),
  executionSignature: z.string().min(1, 'Execution signature is required'), // To lookup context
});

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json(ApiError.methodNotAllowed(req.method || 'unknown'));
  }

  try {
    // Validate request body
    const result = swapFinalizationSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid swap finalization data',
          details: result.error.format(),
        },
      });
    }

    const { serializedSignedExecutionTransaction, executionSignature } = result.data;

    console.log('Processing sponsored swap finalization for execution:', executionSignature);

    // Get execution context
    const executionContext = getExecutionContext(executionSignature);
    if (!executionContext) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'EXECUTION_CONTEXT_NOT_FOUND',
          message: 'Execution context not found or expired. Please restart the swap process.',
        },
      });
    }

    try {
      // Finalize the sponsored swap execution with context
      const finalizationResult = await stableswapService.finalizeSponsoredSwap({
        serializedSignedExecutionTransaction,
        swapDetails: executionContext.swapDetails,
      });

      // Clean up execution context after successful finalization
      deleteExecutionContext(executionSignature);

      console.log(
        `Sponsored swap finalized successfully. Transaction: ${finalizationResult.transactionSignature}`,
      );

      return res.status(200).json({
        success: true,
        data: finalizationResult,
      });
    } catch (error) {
      console.error('Failed to finalize sponsored swap:', error);

      if (error instanceof StableswapServiceError) {
        let statusCode = 500;

        if (error.code.includes('INVALID_EXECUTION_TRANSACTION')) {
          statusCode = 400;
        } else if (error.code.includes('EXECUTION_ALREADY_SIGNED')) {
          statusCode = 400;
        } else if (error.code.includes('INVALID_EXECUTION_FEE_PAYER')) {
          statusCode = 400;
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
          code: 'SWAP_FINALIZATION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to finalize swap',
        },
      });
    }
  } catch (error) {
    console.error('Unexpected error in swap finalization endpoint:', error);
    return res.status(500).json(ApiError.internalServerError(error));
  }
}

export default withRateLimit(
  (req, res) => withAuthMiddleware(handler, { validateWallet: false })(req, res),
  'payment',
);
