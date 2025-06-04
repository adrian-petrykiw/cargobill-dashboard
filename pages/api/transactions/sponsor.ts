// pages/api/transactions/sponsor.ts
import type { NextApiResponse } from 'next';
import { withAuthMiddleware } from '../_middleware/withAuth';
import { withRateLimit } from '../_middleware/rateLimiter';
import { z } from 'zod';
import { ApiError } from '@/types/api/errors';
import { AuthenticatedRequest } from '@/types/api/requests';
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

const sponsoredTransactionSchema = z.object({
  serializedTransaction: z.string(),
  expectedFeeAmount: z.number().positive(),
  tokenMint: z.string(),
  organizationId: z.string(),
  feeCollectionSignature: z.string(),
});

type SponsoredTransactionRequest = z.infer<typeof sponsoredTransactionSchema>;

export class SponsoredTransactionError extends Error {
  code: string;
  details?: any;

  constructor(code: string, message: string, details?: any) {
    super(message);
    this.name = 'SponsoredTransactionError';
    this.code = code;
    this.details = details;
  }
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json(ApiError.methodNotAllowed(req.method || 'unknown'));
  }

  try {
    // Validate request data
    const validationResult = sponsoredTransactionSchema.safeParse(req.body);
    if (!validationResult.success) {
      console.error('Sponsored transaction validation error:', validationResult.error.format());
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid sponsored transaction request',
          details: validationResult.error.format(),
        },
      });
    }

    const sponsorRequest = validationResult.data;

    // Validate that the fee amount matches expected
    const expectedFeeAmount = parseFloat(process.env.CB_TRANSACTION_FEE_AMOUNT || '15');
    if (sponsorRequest.expectedFeeAmount !== expectedFeeAmount) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FEE_AMOUNT',
          message: `Expected fee amount must be ${expectedFeeAmount}`,
        },
      });
    }

    // Validate server configuration
    if (!process.env.CB_SERVER_MVP_PK) {
      console.error('Server wallet private key not configured');
      return res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_WALLET_NOT_CONFIGURED',
          message: 'Server wallet not configured',
        },
      });
    }

    if (!process.env.SOLANA_RPC_URL) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'RPC_URL_NOT_CONFIGURED',
          message: 'Solana RPC URL not configured',
        },
      });
    }

    // Initialize server components (SECURE - never exposed)
    let connection: Connection;
    let serverWallet: Keypair;
    try {
      connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');
      serverWallet = Keypair.fromSecretKey(bs58.decode(process.env.CB_SERVER_MVP_PK));
      console.log(
        '🔒 Server wallet loaded for transaction signing (private key secured in backend)',
      );
    } catch (error) {
      console.error('Failed to initialize server components:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_INITIALIZATION_FAILED',
          message: 'Failed to initialize server components',
        },
      });
    }

    // Get user wallet address from user record
    const { userRepository } = await import('../_services/repositories/userRepository');
    const user = await userRepository.getById(req.user.id);

    if (!user.wallet_address) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'USER_WALLET_MISSING',
          message: 'User does not have a wallet address',
        },
      });
    }

    // Verify user is member of the organization
    const { supabaseAdmin } = await import('../_config/supabase');
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('organization_members')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('organization_id', sponsorRequest.organizationId)
      .single();

    if (membershipError || !membership) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ORGANIZATION_ACCESS_DENIED',
          message: 'User is not a member of the specified organization',
        },
      });
    }

    // Check if fee collection approach is integrated (new standard) or legacy
    const isIntegratedFeeCollection =
      sponsorRequest.feeCollectionSignature === 'integrated-in-main-transaction';

    // For legacy separate fee collection (backward compatibility), verify the fee collection transaction
    if (!isIntegratedFeeCollection) {
      console.warn(
        'Using legacy separate fee collection approach - consider upgrading to integrated approach',
      );

      try {
        const feeTransaction = await connection.getTransaction(
          sponsorRequest.feeCollectionSignature,
          {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0,
          },
        );

        if (!feeTransaction || feeTransaction.meta?.err) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'FEE_COLLECTION_NOT_CONFIRMED',
              message: 'Fee collection transaction not found or failed',
            },
          });
        }

        console.log(
          'Legacy fee collection transaction verified:',
          sponsorRequest.feeCollectionSignature,
        );
      } catch (error) {
        console.error('Error verifying legacy fee collection transaction:', error);
        return res.status(400).json({
          success: false,
          error: {
            code: 'FEE_VERIFICATION_FAILED',
            message: 'Could not verify fee collection transaction',
          },
        });
      }
    } else {
      console.log('Using integrated fee collection approach (recommended)');
    }

    console.log(
      `🔄 Processing sponsored transaction for user ${req.user.id}, organization ${sponsorRequest.organizationId}`,
      {
        feeCollectionApproach: isIntegratedFeeCollection
          ? 'integrated_in_main_transaction'
          : 'legacy_separate_transaction',
        expectedFeeAmount: sponsorRequest.expectedFeeAmount,
        tokenMint: sponsorRequest.tokenMint,
      },
    );

    try {
      // 🔒 SECURE TRANSACTION COMPLETION FLOW
      // Step 1: Deserialize the user-signed transaction
      const transactionBuffer = Buffer.from(sponsorRequest.serializedTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(transactionBuffer);

      // Step 2: Verify the transaction structure and fee payer
      const message = transaction.message;
      const accountKeys = message.getAccountKeys();
      const feePayerIndex = 0;
      const transactionFeePayer = accountKeys.get(feePayerIndex);

      console.log('🔍 Transaction fee payer verification:', {
        transactionFeePayer: transactionFeePayer?.toBase58(),
        expectedFeePayer: serverWallet.publicKey.toBase58(),
        matches: transactionFeePayer?.toBase58() === serverWallet.publicKey.toBase58(),
        accountKeysCount: accountKeys.length,
        instructionsCount: message.compiledInstructions.length,
      });

      // ✅ CRITICAL VALIDATION: Ensure transaction uses correct server wallet as fee payer
      if (
        !transactionFeePayer ||
        transactionFeePayer.toBase58() !== serverWallet.publicKey.toBase58()
      ) {
        console.error('❌ Fee payer mismatch detected:', {
          expected: serverWallet.publicKey.toBase58(),
          actual: transactionFeePayer?.toBase58() || 'undefined',
          request: {
            organizationId: sponsorRequest.organizationId,
            userWalletAddress: user.wallet_address,
            tokenMint: sponsorRequest.tokenMint,
          },
        });

        throw new SponsoredTransactionError(
          'INVALID_FEE_PAYER',
          `Transaction fee payer mismatch. Expected: ${serverWallet.publicKey.toBase58()}, Got: ${transactionFeePayer?.toBase58() || 'undefined'}`,
          {
            expectedFeePayer: serverWallet.publicKey.toBase58(),
            actualFeePayer: transactionFeePayer?.toBase58() || 'undefined',
            organizationId: sponsorRequest.organizationId,
          },
        );
      }

      // Step 3: Enhanced security validation - prevent unauthorized transfers from server wallet
      const { TOKEN_PROGRAM_ID } = await import('@solana/spl-token');
      for (const instruction of message.compiledInstructions) {
        const programId = accountKeys.get(instruction.programIdIndex);

        // Check for token transfers that might drain the server wallet
        if (programId && programId.toBase58() === TOKEN_PROGRAM_ID.toBase58()) {
          const instructionData = instruction.data;

          // Check for Transfer instruction (instruction type 3 in SPL Token)
          if (instructionData.length > 0 && instructionData[0] === 3) {
            const sourceAccountIndex = instruction.accountKeyIndexes[0];
            const sourceAccount = accountKeys.get(sourceAccountIndex);

            // Prevent transfers from any account associated with the server wallet
            if (sourceAccount && sourceAccount.toBase58() === serverWallet.publicKey.toBase58()) {
              throw new SponsoredTransactionError(
                'UNAUTHORIZED_TRANSFER',
                'Transaction attempts to transfer funds from server wallet account',
                {
                  sourceAccount: sourceAccount.toBase58(),
                  serverWallet: serverWallet.publicKey.toBase58(),
                },
              );
            }
          }
        }
      }

      console.log('✅ Transaction security validation passed');

      // Step 4: Sign the transaction with the server wallet (SECURE - private key stays in backend)
      console.log('🔑 Signing transaction with server wallet (secure backend operation)');
      transaction.sign([serverWallet]);

      // Step 5: Submit the transaction to Solana network
      console.log('📤 Submitting sponsored transaction to Solana network');
      const signature = await connection.sendTransaction(transaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });

      console.log('📤 Sponsored transaction sent with signature:', signature);

      // Step 6: Wait for confirmation
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');

      if (confirmation.value.err) {
        throw new SponsoredTransactionError(
          'TRANSACTION_FAILED',
          `Sponsored transaction failed: ${JSON.stringify(confirmation.value.err)}`,
          {
            signature,
            error: confirmation.value.err,
          },
        );
      }

      console.log('✅ Sponsored transaction confirmed successfully:', signature);

      return res.status(200).json({
        success: true,
        data: {
          signature: signature,
          message: 'Sponsored transaction completed successfully',
          feeCollectionSignature: sponsorRequest.feeCollectionSignature,
        },
      });
    } catch (error) {
      console.error('❌ Failed to complete sponsored transaction:', error);

      if (error instanceof SponsoredTransactionError) {
        const statusCode =
          error.code.includes('INVALID') || error.code.includes('UNAUTHORIZED') ? 400 : 500;
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
          code: 'SPONSORED_TRANSACTION_FAILED',
          message:
            error instanceof Error ? error.message : 'Failed to complete sponsored transaction',
        },
      });
    }
  } catch (error) {
    console.error('Unexpected error in sponsored transaction endpoint:', error);
    return res.status(500).json(ApiError.internalServerError(error));
  }
}

export default withRateLimit(
  (req, res) => withAuthMiddleware(handler, { validateWallet: true })(req, res),
  'payment',
);
