// pages/api/swap/execute.ts
import { NextApiResponse } from 'next';
import { withAuthMiddleware } from '../_middleware/withAuth';
import { withRateLimit } from '../_middleware/rateLimiter';
import { organizationRepository } from '../_services/repositories/organizationRepository';
import { stableswapService, StableswapServiceError } from '../_services/stableswapService';
import { solanaService } from '../_services/solanaService';
import { ApiError } from '@/types/api/errors';
import { AuthenticatedRequest } from '@/types/api/requests';
import { z } from 'zod';
import {
  getPreparedTransaction,
  deletePreparedTransaction,
  storeExecutionContext,
} from './prepare';
import { Transaction, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

// Validation schema for swap execution request
const swapExecutionSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  transactionId: z.string().min(1, 'Transaction ID is required'),
  serializedSignedTransaction: z.string().min(1, 'Signed transaction is required'),
});

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json(ApiError.methodNotAllowed(req.method || 'unknown'));
  }

  try {
    // Validate request body
    const result = swapExecutionSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid swap execution data',
          details: result.error.format(),
        },
      });
    }

    const { organizationId, transactionId, serializedSignedTransaction } = result.data;

    console.log(
      `Processing sponsored swap execution for organization: ${organizationId}, transaction: ${transactionId}`,
    );

    // Retrieve prepared transaction
    const preparedTransaction = getPreparedTransaction(transactionId);
    if (!preparedTransaction) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TRANSACTION_NOT_FOUND',
          message: 'Transaction not found or expired. Please prepare a new swap.',
        },
      });
    }

    // Verify organization matches
    if (preparedTransaction.organizationId !== organizationId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ORGANIZATION_MISMATCH',
          message: 'Transaction does not belong to this organization',
        },
      });
    }

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
      console.error('Failed to get organization for swap execution:', error);
      return res.status(404).json({
        success: false,
        error: {
          code: 'ORGANIZATION_NOT_FOUND',
          message: 'Organization not found',
        },
      });
    }

    try {
      // Validate and execute the sponsored transaction
      const executionResult = await stableswapService.executeSponsoredSwap({
        transactionId,
        preparedTransaction,
        serializedSignedTransaction,
        organizationAddress: organization.operational_wallet.address,
      });

      // Check if execution step is needed
      if (executionResult.needsExecution && executionResult.executionTransaction) {
        // Store execution context for finalization
        storeExecutionContext(
          executionResult.transactionSignature,
          organizationId,
          preparedTransaction.swapDetails,
          preparedTransaction.originalParams,
        );

        // Clean up prepared transaction now that we have execution context
        deletePreparedTransaction(transactionId);

        console.log(
          `Sponsored swap proposal created. Execution needed. Transaction: ${executionResult.transactionSignature}`,
        );
      } else {
        // Single-step execution completed - clean up prepared transaction
        deletePreparedTransaction(transactionId);

        console.log(
          `Sponsored swap executed successfully. Transaction: ${executionResult.transactionSignature}`,
        );
      }

      return res.status(200).json({
        success: true,
        data: executionResult,
      });
    } catch (error) {
      console.error('Failed to execute sponsored swap:', error);

      if (error instanceof StableswapServiceError) {
        let statusCode = 500;

        if (error.code.includes('TRANSACTION_TAMPERED')) {
          statusCode = 400;
        } else if (error.code.includes('INVALID_SIGNATURE')) {
          statusCode = 400;
        } else if (error.code.includes('TRANSACTION_EXPIRED')) {
          statusCode = 400;
        } else if (error.code.includes('INSUFFICIENT_BALANCE')) {
          statusCode = 400;
        } else if (error.code.includes('MARKET_CONDITIONS_CHANGED')) {
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
          code: 'SWAP_EXECUTION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to execute swap',
        },
      });
    }
  } catch (error) {
    console.error('Unexpected error in sponsored swap execution endpoint:', error);
    return res.status(500).json(ApiError.internalServerError(error));
  }
}

export default withRateLimit(
  (req, res) => withAuthMiddleware(handler, { validateWallet: false })(req, res),
  'payment',
);
