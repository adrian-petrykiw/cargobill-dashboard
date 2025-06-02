// pages/api/_services/jupiterService.ts
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { TokenType } from '@/types/token';
import { TOKENS } from '@/constants/solana';
import * as multisig from '@sqds/multisig';
import axios from 'axios';

export class JupiterServiceError extends Error {
  code: string;
  details?: any;

  constructor(code: string, message: string, details?: any) {
    super(message);
    this.name = 'JupiterServiceError';
    this.code = code;
    this.details = details;
  }
}

export interface JupiterSwapParams {
  multisigAddress: string;
  fromToken: TokenType;
  toToken: TokenType;
  amount: number;
  slippageTolerance: number;
}

export interface JupiterSwapSimulationResult {
  fromToken: TokenType;
  toToken: TokenType;
  amountIn: number;
  estimatedAmountOut: number;
  minimumAmountOut: number;
  priceImpact: number;
  exchangeRate: number;
  fees: {
    protocolFee: number;
    networkFee: number;
    totalFee: number;
  };
  route: 'jupiter';
  routeDetails: {
    provider: string;
    priceImpactWarning: boolean;
  };
  estimatedExecutionTime: string;
}

export const jupiterService = {
  async simulateSwap(params: JupiterSwapParams): Promise<JupiterSwapSimulationResult> {
    // Check server configuration
    if (!process.env.SOLANA_RPC_URL) {
      throw new JupiterServiceError('MISSING_RPC_URL', 'Solana RPC URL not configured');
    }

    let connection: Connection;
    try {
      connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');
    } catch (error) {
      throw new JupiterServiceError(
        'CONNECTION_FAILED',
        'Failed to establish connection to Solana',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }

    try {
      // Get token mints
      const inputMint = this.getTokenMint(params.fromToken);
      const outputMint = this.getTokenMint(params.toToken);

      if (!inputMint || !outputMint) {
        throw new JupiterServiceError(
          'INVALID_TOKEN_MINT',
          `Invalid token mint for ${params.fromToken} or ${params.toToken}`,
        );
      }

      // Convert amount to proper decimals (6 decimals for stablecoins)
      const amountInLamports = Math.floor(params.amount * 1_000_000);

      // Call Jupiter Quote API
      const quoteResponse = await axios.get('https://lite-api.jup.ag/swap/v1/quote', {
        params: {
          inputMint: inputMint.toBase58(),
          outputMint: outputMint.toBase58(),
          amount: amountInLamports,
          slippageBps: Math.floor(params.slippageTolerance * 100), // Convert to basis points
          restrictIntermediateTokens: true, // Use highly liquid intermediate tokens
          dynamicSlippage: true, // Enable dynamic slippage estimation
        },
        timeout: 10000, // 10 second timeout
      });

      if (!quoteResponse.data) {
        throw new JupiterServiceError('NO_QUOTE_RECEIVED', 'No quote received from Jupiter');
      }

      const quote = quoteResponse.data;

      // Validate quote response
      if (!quote.outAmount || !quote.inAmount) {
        throw new JupiterServiceError('INVALID_QUOTE', 'Invalid quote data received from Jupiter');
      }

      const estimatedAmountOut = parseInt(quote.outAmount) / 1_000_000; // Convert back to regular units
      const priceImpactPct = parseFloat(quote.priceImpactPct || '0');
      const minimumAmountOut = estimatedAmountOut * (1 - params.slippageTolerance / 100);

      // Log route information for debugging
      if (quote.routePlan && quote.routePlan.length > 0) {
        console.log(
          'Jupiter route plan:',
          quote.routePlan.map((step: any) => step.swapInfo?.label).join(' -> '),
        );
      }

      return {
        fromToken: params.fromToken,
        toToken: params.toToken,
        amountIn: params.amount,
        estimatedAmountOut,
        minimumAmountOut,
        priceImpact: priceImpactPct,
        exchangeRate: estimatedAmountOut / params.amount,
        fees: {
          protocolFee: 0, // Jupiter doesn't charge protocol fees
          networkFee: 0.001, // Estimated network fee in SOL
          totalFee: 0.001,
        },
        route: 'jupiter',
        routeDetails: {
          provider: 'Jupiter Aggregator',
          priceImpactWarning: priceImpactPct > 1,
        },
        estimatedExecutionTime: '~10 seconds',
      };
    } catch (error) {
      console.error('Jupiter simulation failed:', error);

      if (error instanceof JupiterServiceError) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 429) {
          throw new JupiterServiceError(
            'RATE_LIMITED',
            'Jupiter API rate limit exceeded. Please try again later.',
          );
        } else if (status && status >= 500) {
          throw new JupiterServiceError(
            'JUPITER_SERVER_ERROR',
            'Jupiter API server error. Please try again later.',
          );
        } else if (error.code === 'ECONNABORTED') {
          throw new JupiterServiceError(
            'JUPITER_TIMEOUT',
            'Jupiter API request timed out. Please try again.',
          );
        }
      }

      throw new JupiterServiceError(
        'JUPITER_SIMULATION_FAILED',
        'Failed to simulate swap via Jupiter',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  async createSwapTransaction(params: JupiterSwapParams): Promise<TransactionMessage> {
    // Check server configuration
    if (!process.env.SOLANA_RPC_URL) {
      throw new JupiterServiceError('MISSING_RPC_URL', 'Solana RPC URL not configured');
    }

    let connection: Connection;
    try {
      connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');
    } catch (error) {
      throw new JupiterServiceError(
        'CONNECTION_FAILED',
        'Failed to establish connection to Solana',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }

    try {
      // Get multisig and vault PDAs
      const multisigPda = new PublicKey(params.multisigAddress);
      const [vaultPda] = multisig.getVaultPda({ multisigPda, index: 0 });

      // Get token mints
      const inputMint = this.getTokenMint(params.fromToken);
      const outputMint = this.getTokenMint(params.toToken);

      if (!inputMint || !outputMint) {
        throw new JupiterServiceError(
          'INVALID_TOKEN_MINT',
          `Invalid token mint for ${params.fromToken} or ${params.toToken}`,
        );
      }

      const amountInLamports = Math.floor(params.amount * 1_000_000);

      // Get fresh quote for transaction creation
      const quoteResponse = await axios.get('https://lite-api.jup.ag/swap/v1/quote', {
        params: {
          inputMint: inputMint.toBase58(),
          outputMint: outputMint.toBase58(),
          amount: amountInLamports,
          slippageBps: Math.floor(params.slippageTolerance * 100),
          restrictIntermediateTokens: true,
          dynamicSlippage: true,
        },
        timeout: 10000,
      });

      if (!quoteResponse.data) {
        throw new JupiterServiceError('NO_QUOTE_RECEIVED', 'No quote received from Jupiter');
      }

      // Get swap transaction from Jupiter
      const swapResponse = await axios.post(
        'https://lite-api.jup.ag/swap/v1/swap',
        {
          quoteResponse: quoteResponse.data,
          userPublicKey: vaultPda.toBase58(), // Use vault as the user
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true, // Enable dynamic compute unit estimation
          dynamicSlippage: true, // Enable dynamic slippage
          prioritizationFeeLamports: {
            priorityLevelWithMaxLamports: {
              maxLamports: 1000000, // Max 0.001 SOL for priority fee
              priorityLevel: 'high' as const,
            },
          },
        },
        {
          timeout: 15000, // 15 second timeout
        },
      );

      if (!swapResponse.data || !swapResponse.data.swapTransaction) {
        throw new JupiterServiceError(
          'NO_TRANSACTION_RECEIVED',
          'No transaction received from Jupiter',
        );
      }

      // Deserialize the transaction
      const swapTransactionBuf = Buffer.from(swapResponse.data.swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();

      // Create transaction message
      const transactionMessage = new TransactionMessage({
        payerKey: vaultPda,
        recentBlockhash: blockhash,
        instructions: transaction.message.compiledInstructions.map((instruction: any) => ({
          programId: transaction.message.staticAccountKeys[instruction.programIdIndex],
          keys: instruction.accountKeyIndexes.map((index: number) => ({
            pubkey: transaction.message.staticAccountKeys[index],
            isSigner: index < transaction.message.header.numRequiredSignatures,
            isWritable:
              index <
                transaction.message.header.numRequiredSignatures -
                  transaction.message.header.numReadonlySignedAccounts ||
              (index >= transaction.message.header.numRequiredSignatures &&
                index <
                  transaction.message.staticAccountKeys.length -
                    transaction.message.header.numReadonlyUnsignedAccounts),
          })),
          data: Buffer.from(instruction.data),
        })),
      });

      console.log('Jupiter swap transaction created successfully');

      return transactionMessage;
    } catch (error) {
      console.error('Failed to create Jupiter swap transaction:', error);

      if (error instanceof JupiterServiceError) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 429) {
          throw new JupiterServiceError(
            'RATE_LIMITED',
            'Jupiter API rate limit exceeded. Please try again later.',
          );
        } else if (status && status >= 500) {
          throw new JupiterServiceError(
            'JUPITER_SERVER_ERROR',
            'Jupiter API server error. Please try again later.',
          );
        }
      }

      throw new JupiterServiceError(
        'TRANSACTION_CREATION_FAILED',
        'Failed to create Jupiter swap transaction',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  getTokenMint(tokenType: TokenType): PublicKey | null {
    const tokenInfo = TOKENS[tokenType];
    return tokenInfo?.mint || null;
  },
};
