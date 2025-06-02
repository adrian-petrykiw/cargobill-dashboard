// pages/api/swap/prepare.ts
import { NextApiResponse } from 'next';
import { withAuthMiddleware } from '../_middleware/withAuth';
import { withRateLimit } from '../_middleware/rateLimiter';
import { organizationRepository } from '../_services/repositories/organizationRepository';
import { stableswapService, StableswapServiceError } from '../_services/stableswapService';
import { ApiError } from '@/types/api/errors';
import { AuthenticatedRequest } from '@/types/api/requests';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import bs58 from 'bs58';

// Validation schema for swap preparation request
const swapPreparationSchema = z
  .object({
    organizationId: z.string().min(1, 'Organization ID is required'),
    fromToken: z.enum(['USDC', 'USDT', 'EURC'] as const),
    toToken: z.enum(['USDC', 'USDT', 'EURC'] as const),
    amount: z.number().positive('Amount must be positive'),
    slippageTolerance: z.number().min(0.1).max(5),
    expectedAmountOut: z.number().positive('Expected amount out must be positive'),
    maxSlippageDeviation: z.number().min(0).max(0.1).optional().default(0.02),
  })
  .refine((data) => data.fromToken !== data.toToken, {
    message: 'From and to tokens must be different',
  });

// In-memory cache for prepared transactions (with TTL)
const preparedTransactions = new Map<
  string,
  {
    organizationId: string;
    originalParams: any;
    transactionMessage: any;
    swapDetails: any;
    createdAt: number;
    expiresAt: number;
  }
>();

// NEW: In-memory cache for execution context (maps execution signatures to swap details)
const executionContext = new Map<
  string,
  {
    organizationId: string;
    swapDetails: any;
    originalParams: any;
    createdAt: number;
    expiresAt: number;
  }
>();

// Cleanup expired transactions every 5 minutes
const TRANSACTION_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;

  // Clean prepared transactions
  for (const [id, data] of preparedTransactions.entries()) {
    if (data.expiresAt < now) {
      preparedTransactions.delete(id);
      cleanedCount++;
    }
  }

  // Clean execution context
  for (const [id, data] of executionContext.entries()) {
    if (data.expiresAt < now) {
      executionContext.delete(id);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(
      `Cleaned up ${cleanedCount} expired transactions. Active prepared: ${preparedTransactions.size}, execution contexts: ${executionContext.size}`,
    );
  }
}, CLEANUP_INTERVAL_MS);

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json(ApiError.methodNotAllowed(req.method || 'unknown'));
  }

  try {
    // Validate request body
    const result = swapPreparationSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid swap preparation data',
          details: result.error.format(),
        },
      });
    }

    const {
      organizationId,
      fromToken,
      toToken,
      amount,
      slippageTolerance,
      expectedAmountOut,
      maxSlippageDeviation,
    } = result.data;

    console.log(
      `Preparing swap transaction for organization: ${organizationId}, ${amount} ${fromToken} -> ${toToken}`,
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
      console.error('Failed to get organization for swap preparation:', error);
      return res.status(404).json({
        success: false,
        error: {
          code: 'ORGANIZATION_NOT_FOUND',
          message: 'Organization not found',
        },
      });
    }

    // Get server wallet address for fee paying
    if (!process.env.CB_SERVER_MVP_PK) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_WALLET_NOT_CONFIGURED',
          message: 'Server wallet not configured',
        },
      });
    }

    try {
      // Prepare the swap transaction using the stableswap service
      const preparationResult = await stableswapService.prepareSwapTransaction({
        multisigAddress: organization.operational_wallet.address,
        fromToken,
        toToken,
        amount,
        slippageTolerance,
        expectedAmountOut,
        maxSlippageDeviation,
      });

      // Generate unique transaction ID
      const transactionId = uuidv4();
      const expiresAt = Date.now() + TRANSACTION_EXPIRY_MS;

      // Store transaction details for later validation
      preparedTransactions.set(transactionId, {
        organizationId,
        originalParams: {
          fromToken,
          toToken,
          amount,
          slippageTolerance,
          expectedAmountOut,
          maxSlippageDeviation,
        },
        transactionMessage: preparationResult.transactionMessage,
        swapDetails: preparationResult.swapDetails,
        createdAt: Date.now(),
        expiresAt,
      });

      console.log(
        `Transaction prepared with ID: ${transactionId}, expires at: ${new Date(expiresAt).toISOString()}`,
      );

      // Serialize transaction for frontend
      const serializedTransaction = Buffer.from(
        preparationResult.unsignedTransaction.serialize(),
      ).toString('base64');

      return res.status(200).json({
        success: true,
        data: {
          serializedTransaction,
          transactionId,
          feePayerAddress: preparationResult.feePayerAddress,
          expiresAt,
          swapDetails: preparationResult.swapDetails,
        },
      });
    } catch (error) {
      console.error('Failed to prepare swap:', error);

      if (error instanceof StableswapServiceError) {
        let statusCode = 500;

        if (error.code.includes('INSUFFICIENT_BALANCE')) {
          statusCode = 400;
        } else if (error.code.includes('MARKET_CONDITIONS_CHANGED')) {
          statusCode = 400;
        } else if (error.code.includes('INVALID')) {
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
          code: 'SWAP_PREPARATION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to prepare swap',
        },
      });
    }
  } catch (error) {
    console.error('Unexpected error in swap preparation endpoint:', error);
    return res.status(500).json(ApiError.internalServerError(error));
  }
}

// Export both the handler and the cache management functions
export const getPreparedTransaction = (transactionId: string) => {
  const transaction = preparedTransactions.get(transactionId);

  if (!transaction) {
    return null;
  }

  // Check if expired
  if (transaction.expiresAt < Date.now()) {
    preparedTransactions.delete(transactionId);
    return null;
  }

  return transaction;
};

export const deletePreparedTransaction = (transactionId: string) => {
  preparedTransactions.delete(transactionId);
};

// NEW: Store execution context for finalization
export const storeExecutionContext = (
  executionSignature: string,
  organizationId: string,
  swapDetails: any,
  originalParams: any,
) => {
  const expiresAt = Date.now() + TRANSACTION_EXPIRY_MS;

  executionContext.set(executionSignature, {
    organizationId,
    swapDetails,
    originalParams,
    createdAt: Date.now(),
    expiresAt,
  });

  console.log(`Stored execution context for signature: ${executionSignature}`);
};

// NEW: Get execution context for finalization
export const getExecutionContext = (executionSignature: string) => {
  const context = executionContext.get(executionSignature);

  if (!context) {
    return null;
  }

  // Check if expired
  if (context.expiresAt < Date.now()) {
    executionContext.delete(executionSignature);
    return null;
  }

  return context;
};

// NEW: Delete execution context after finalization
export const deleteExecutionContext = (executionSignature: string) => {
  executionContext.delete(executionSignature);
};

export default withRateLimit(
  (req, res) => withAuthMiddleware(handler, { validateWallet: false })(req, res),
  'standard',
);
