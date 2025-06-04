// pages/api/transactions/create-payment.ts
import type { NextApiResponse } from 'next';
import { withAuthMiddleware } from '../_middleware/withAuth';
import { withRateLimit } from '../_middleware/rateLimiter';
import { squadsService, SquadsServiceError } from '../_services/squadsService';
import { z } from 'zod';
import { ApiError } from '@/types/api/errors';
import { AuthenticatedRequest } from '@/types/api/requests';
import { PublicKey, TransactionMessage, Connection } from '@solana/web3.js';
import { getVaultPda, accounts } from '@sqds/multisig';
import { getAssociatedTokenAddress, createTransferInstruction } from '@solana/spl-token';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  TOKENS,
  USDC_MINT,
} from '@/constants/solana';

const createPaymentTransactionSchema = z.object({
  organizationId: z.string().uuid(),
  invoice: z.object({
    number: z.string(),
    amount: z.number().positive(),
    index: z.number().min(0),
    totalInvoices: z.number().positive(),
  }),
  tokenType: z.enum(['USDC', 'USDT', 'EURC']),
  vendorMultisigAddress: z.string(),
  transferMessage: z.object({
    payerKey: z.string(),
    recentBlockhash: z.string(),
    instructions: z.array(z.any()),
  }),
  memo: z.string(),
  includeTransactionFee: z.boolean(),
});

type CreatePaymentTransactionRequest = z.infer<typeof createPaymentTransactionSchema>;

interface CreatePaymentTransactionResponse {
  createTransaction: string;
  proposeTransaction: string;
  executeTransaction: string;
  transactionIndex: string;
  multisigAddress: string;
  vaultAddress: string;
  blockhash: string;
  lastValidBlockHeight: number;
}

// Define the operational wallet type for proper typing
interface OperationalWallet {
  address: string;
  [key: string]: any;
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json(ApiError.methodNotAllowed(req.method || 'unknown'));
  }

  try {
    // Validate request data
    const validationResult = createPaymentTransactionSchema.safeParse(req.body);
    if (!validationResult.success) {
      console.error(
        'Create payment transaction validation error:',
        validationResult.error.format(),
      );
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid create payment transaction request',
          details: validationResult.error.format(),
        },
      });
    }

    const createRequest = validationResult.data;

    // Validate environment configuration (safe to check RPC URL)
    if (!process.env.SOLANA_RPC_URL) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'RPC_URL_NOT_CONFIGURED',
          message: 'Solana RPC URL not configured',
        },
      });
    }

    // Initialize connection (safe to expose RPC URL)
    let connection: Connection;
    try {
      connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');
      console.log('🔗 Connection initialized to Solana network');
    } catch (error) {
      console.error('Failed to initialize connection:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'CONNECTION_INITIALIZATION_FAILED',
          message: 'Failed to initialize connection to Solana network',
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
      .eq('organization_id', createRequest.organizationId)
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

    // Get organization's multisig address
    const { data: organization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('operational_wallet')
      .eq('id', createRequest.organizationId)
      .single();

    if (orgError || !organization?.operational_wallet) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ORGANIZATION_WALLET_NOT_FOUND',
          message: 'Organization does not have an operational wallet',
        },
      });
    }

    // Cast operational_wallet to proper type and validate address
    const operationalWallet = organization.operational_wallet as OperationalWallet;

    if (!operationalWallet.address) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ORGANIZATION_WALLET_ADDRESS_MISSING',
          message: 'Organization operational wallet does not have an address',
        },
      });
    }

    const organizationMultisigAddress = new PublicKey(operationalWallet.address);
    console.log('Organization multisig:', organizationMultisigAddress.toString());

    // Get vault PDA
    const [vaultPda] = getVaultPda({
      multisigPda: organizationMultisigAddress,
      index: 0,
    });
    console.log('Vault PDA:', vaultPda.toString());

    // Get token mint based on tokenType
    const tokenMint = new PublicKey(
      createRequest.tokenType === 'USDC'
        ? USDC_MINT.toString()
        : createRequest.tokenType === 'USDT'
          ? TOKENS.USDT.mint.toString()
          : createRequest.tokenType === 'EURC'
            ? TOKENS.EURC.mint.toString()
            : (() => {
                throw new Error(`Unsupported token type: ${createRequest.tokenType}`);
              })(),
    );

    // Get fee collector address from environment
    if (!process.env.CB_FEE_COLLECTOR_WALLET) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'FEE_COLLECTOR_NOT_CONFIGURED',
          message: 'Fee collector wallet not configured',
        },
      });
    }
    const feeCollectorAddress = new PublicKey(process.env.CB_FEE_COLLECTOR_WALLET);

    // Get multisig account info (this is safe - just reading public blockchain data)
    let senderMultisigInfo;
    try {
      senderMultisigInfo = await accounts.Multisig.fromAccountAddress(
        connection,
        organizationMultisigAddress,
      );
      console.log("Found sender's multisig:", {
        threshold: senderMultisigInfo.threshold.toString(),
        transactionIndex: senderMultisigInfo.transactionIndex.toString(),
      });
    } catch (err) {
      console.error("Failed to find sender's multisig account:", err);
      return res.status(400).json({
        success: false,
        error: {
          code: 'MULTISIG_NOT_FOUND',
          message: "Sender's multisig account not found",
        },
      });
    }

    // Get vault ATA
    const vaultAta = await getAssociatedTokenAddress(
      tokenMint,
      vaultPda,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    // Get fee collector's ATA
    const feeCollectorAta = await getAssociatedTokenAddress(
      tokenMint,
      feeCollectorAddress,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    // Check if fee collector ATA exists
    const feeCollectorAccountInfo = await connection.getAccountInfo(feeCollectorAta);
    if (!feeCollectorAccountInfo) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'FEE_COLLECTOR_ATA_NOT_FOUND',
          message: `Fee collector token account does not exist for ${createRequest.tokenType}`,
        },
      });
    }

    // Get receiver vault ATA
    const receiverMultisigPda = new PublicKey(createRequest.vendorMultisigAddress);
    const [receiverVaultPda] = getVaultPda({
      multisigPda: receiverMultisigPda,
      index: 0,
    });

    const receiverAta = await getAssociatedTokenAddress(
      tokenMint,
      receiverVaultPda,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    // Create transaction instructions (this is safe - just preparing instruction data)
    const instructions = [];

    // Add fee instruction if required
    if (createRequest.includeTransactionFee) {
      const transactionFeeAmount = Math.round(15 * 1e6); // $15 fee in token units
      console.log(`Adding $15 transaction fee to invoice ${createRequest.invoice.number}`);
      const feeIx = createTransferInstruction(
        vaultAta,
        feeCollectorAta,
        vaultPda,
        BigInt(transactionFeeAmount),
      );
      instructions.push(feeIx);
    }

    // Add payment transfer instruction
    const transferAmount = Math.round(createRequest.invoice.amount * 1e6);
    const transferIx = createTransferInstruction(
      vaultAta,
      receiverAta,
      vaultPda,
      BigInt(transferAmount),
    );
    instructions.push(transferIx);

    // Create memo instruction
    const memoIx = {
      keys: [],
      programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
      data: Buffer.from(createRequest.memo),
    };
    instructions.push(memoIx);

    // Get next transaction index
    const currentTransactionIndex = Number(senderMultisigInfo.transactionIndex);
    const newTransactionIndex = BigInt(currentTransactionIndex + createRequest.invoice.index + 1);
    console.log('Using transaction index:', newTransactionIndex.toString());

    // Get current blockhash
    const { blockhash } = await connection.getLatestBlockhash('confirmed');

    // Create transfer message with all instructions (fee + transfer + memo)
    const transferMessage = new TransactionMessage({
      payerKey: vaultPda,
      recentBlockhash: blockhash,
      instructions,
    });

    // 🔒 SECURE: Use squadsService to create payment transactions with server wallet as fee payer
    console.log('🔒 Using squadsService to create payment transaction...');

    try {
      const paymentTransactionsResult = await squadsService.createPaymentTransaction({
        organizationMultisigAddress: organizationMultisigAddress.toString(),
        userWalletAddress: user.wallet_address,
        transactionIndex: newTransactionIndex,
        transferMessage,
        memo: `TX-${createRequest.invoice.number}${createRequest.includeTransactionFee ? '-WITH-FEE' : ''}`,
      });

      console.log('✅ Payment transactions created successfully via secure squadsService');

      // Return serialized transactions for user to sign
      return res.status(200).json({
        success: true,
        data: paymentTransactionsResult,
      });
    } catch (squadsError) {
      console.error('❌ Error creating payment transactions via squadsService:', squadsError);

      if (squadsError instanceof SquadsServiceError) {
        const statusCode =
          squadsError.code.includes('INVALID') || squadsError.code.includes('UNAUTHORIZED')
            ? 400
            : 500;
        return res.status(statusCode).json({
          success: false,
          error: {
            code: squadsError.code,
            message: squadsError.message,
            details: squadsError.details,
          },
        });
      }

      throw squadsError; // Re-throw to be caught by outer catch block
    }
  } catch (error) {
    console.error('❌ Error in create payment transaction endpoint:', error);

    if (error instanceof SquadsServiceError) {
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

    return res.status(500).json(ApiError.internalServerError(error));
  }
}

export default withRateLimit(
  (req, res) => withAuthMiddleware(handler, { validateWallet: true })(req, res),
  'payment',
);
