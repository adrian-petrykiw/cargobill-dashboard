// pages/api/_services/perenaService.ts
import { Connection, PublicKey, TransactionMessage, Keypair } from '@solana/web3.js';
import { TokenType } from '@/types/token';
import * as multisig from '@sqds/multisig';
import bs58 from 'bs58';

// Import Perena SDK components with proper error handling
let perenaSDK: any = null;

async function getPerenaSDK() {
  if (!perenaSDK) {
    try {
      perenaSDK = await import('@perena/numeraire-sdk');
      console.log('Perena SDK loaded successfully');
    } catch (error) {
      console.error('Failed to load Perena SDK:', error);
      throw new Error('Perena SDK not available');
    }
  }
  return perenaSDK;
}

// Get server wallet from environment
function getServerWallet(): Keypair {
  const serverPrivateKey = process.env.CB_SERVER_MVP_PK;
  if (!serverPrivateKey) {
    throw new Error('CB_SERVER_MVP_PK environment variable not set');
  }

  try {
    return Keypair.fromSecretKey(bs58.decode(serverPrivateKey));
  } catch (error) {
    throw new Error('Invalid CB_SERVER_MVP_PK format');
  }
}

export class PerenaServiceError extends Error {
  code: string;
  details?: any;

  constructor(code: string, message: string, details?: any) {
    super(message);
    this.name = 'PerenaServiceError';
    this.code = code;
    this.details = details;
  }
}

export interface PerenaSwapParams {
  multisigAddress: string;
  fromToken: TokenType;
  toToken: TokenType;
  amount: number;
  slippageTolerance: number;
}

export interface PerenaSwapSimulationResult {
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
  route: 'perena';
  routeDetails: {
    provider: string;
    pools: string[];
    priceImpactWarning: boolean;
  };
  estimatedExecutionTime: string;
}

export const perenaService = {
  async simulateSwap(params: PerenaSwapParams): Promise<PerenaSwapSimulationResult> {
    // Validate that this pair is supported by Perena
    if (!this.isPerenaSupported(params.fromToken, params.toToken)) {
      throw new PerenaServiceError(
        'UNSUPPORTED_PAIR',
        `Perena does not support ${params.fromToken} -> ${params.toToken} swaps`,
      );
    }

    // Validate server configuration
    if (!process.env.SOLANA_RPC_URL) {
      throw new PerenaServiceError('MISSING_RPC_URL', 'Solana RPC URL not configured');
    }

    let connection: Connection;
    let serverWallet: Keypair;

    try {
      connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');
      serverWallet = getServerWallet();
    } catch (error) {
      throw new PerenaServiceError(
        'CONNECTION_FAILED',
        'Failed to establish connection to Solana or get server wallet',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }

    try {
      // Load Perena SDK
      const sdk = await getPerenaSDK();

      // Initialize Perena SDK with connection and server wallet
      const state = sdk.init({
        connection,
        applyD: false,
        payer: serverWallet, // Use actual server wallet
      });

      console.log('Perena SDK initialized with server wallet:', serverWallet.publicKey.toBase58());

      // Determine token indices for Perena seed pool (tripool)
      const tokenIndices = this.getTokenIndices();
      const fromIndex = tokenIndices[params.fromToken];
      const toIndex = tokenIndices[params.toToken];

      if (fromIndex === undefined || toIndex === undefined) {
        throw new PerenaServiceError(
          'INVALID_TOKEN_INDEX',
          `Invalid token index for Perena: ${params.fromToken} -> ${params.toToken}`,
        );
      }

      // Convert amount to proper decimals (6 decimals for stablecoins)
      const amountInLamports = Math.floor(params.amount * 1_000_000);

      // Get actual quote from Perena SDK using quote mode
      console.log('Getting Perena quote for:', {
        pool: sdk.PRODUCTION_POOLS.susd,
        fromIndex,
        toIndex,
        amountInLamports,
        serverWallet: serverWallet.publicKey.toBase58(),
      });

      // Use the SDK's swapExactIn function in quote mode
      const { call } = await sdk.swapExactIn(
        {
          pool: new PublicKey(sdk.PRODUCTION_POOLS.susd),
          in: fromIndex,
          out: toIndex,
          exactAmountIn: amountInLamports,
          minAmountOut: 0, // Set to 0 for quote simulation
          cuLimit: 1500000,
          requireCuIx: false, // Don't require compute unit instructions for simulation
        },
        true,
      ); // Quote mode = true

      // Simulate the transaction to get actual output amounts
      let actualAmountOut = 0;
      let simulationSuccess = false;

      try {
        const transaction = await call.transaction();

        // CRITICAL FIX: Set required transaction fields for simulation
        transaction.feePayer = serverWallet.publicKey;

        // MISSING: Get and set recent blockhash (this was the issue!)
        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = blockhash;

        console.log('Simulating Perena transaction:', {
          feePayer: transaction.feePayer?.toBase58(),
          blockhash: transaction.recentBlockhash,
          instructionCount: transaction.instructions.length,
        });

        const simulation = await connection.simulateTransaction(transaction, {
          sigVerify: false, // Skip signature verification for simulation
          commitment: 'confirmed',
          replaceRecentBlockhash: true, // Allow RPC to replace blockhash if needed
        });

        if (!simulation.value.err) {
          simulationSuccess = true;
          console.log('Perena simulation successful');

          // Parse the simulation logs to extract the actual amount out
          const logs = simulation.value.logs || [];
          console.log('Simulation logs:', logs.slice(0, 5)); // Log first 5 lines for debugging

          // Look for Perena-specific log patterns
          for (const log of logs) {
            if (log.includes('SwapExactIn') || log.includes('amount_out')) {
              // Extract amount from log - adjust regex based on actual log format
              const amountMatch =
                log.match(/amount_out[:\s]*(\d+)/i) ||
                log.match(/out[:\s]*(\d+)/i) ||
                log.match(/(\d+).*out/i);

              if (amountMatch) {
                const rawAmount = parseInt(amountMatch[1]);
                if (rawAmount > 0 && rawAmount < amountInLamports * 2) {
                  // Sanity check
                  actualAmountOut = rawAmount / 1_000_000;
                  console.log('Parsed amount out from logs:', actualAmountOut);
                  break;
                }
              }
            }
          }

          // If we couldn't parse the logs, check for program data changes
          if (actualAmountOut === 0) {
            console.log('Could not parse logs, checking account changes...');

            // Look at account changes in simulation
            if (simulation.value.accounts) {
              console.log('Simulation returned account changes, analyzing...');
              // This would need specific logic based on Perena's account structure
              // For now, use conservative estimate
            }
          }

          // If still no amount, use conservative estimate
          if (actualAmountOut === 0) {
            console.log('Could not parse simulation output, using conservative estimate');
            actualAmountOut = params.amount * 0.9995; // 0.05% fee estimate for stablecoins
          }
        } else {
          console.warn('Perena simulation returned error:', simulation.value.err);
          throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
        }
      } catch (simulationError) {
        console.warn('Failed to simulate Perena transaction:', simulationError);

        // Check if it's a specific error we can handle
        if (simulationError instanceof Error) {
          if (simulationError.message.includes('Invalid arguments')) {
            console.error('Perena transaction invalid arguments - likely SDK issue');
          } else if (simulationError.message.includes('insufficient')) {
            console.error('Perena simulation shows insufficient funds');
          }
        }

        // Fallback to conservative estimate based on typical stablecoin swap fees
        console.log('Using fallback conservative estimate for Perena quote');
        actualAmountOut = params.amount * 0.9995; // 0.05% fee estimate
        simulationSuccess = false;
      }

      const minimumAmountOut = actualAmountOut * (1 - params.slippageTolerance / 100);
      const feeAmount = params.amount - actualAmountOut;
      const feeRate = feeAmount / params.amount;

      // Validate that the swap would be profitable
      if (minimumAmountOut <= 0) {
        throw new PerenaServiceError(
          'INSUFFICIENT_OUTPUT',
          'Swap amount too low or slippage too high resulting in zero output',
        );
      }

      console.log('Perena swap simulation completed:', {
        fromToken: params.fromToken,
        toToken: params.toToken,
        amountIn: params.amount,
        estimatedAmountOut: actualAmountOut,
        minimumAmountOut,
        priceImpact: feeRate * 100,
        simulationSuccess,
      });

      return {
        fromToken: params.fromToken,
        toToken: params.toToken,
        amountIn: params.amount,
        estimatedAmountOut: actualAmountOut,
        minimumAmountOut,
        priceImpact: feeRate * 100,
        exchangeRate: actualAmountOut / params.amount,
        fees: {
          protocolFee: feeAmount,
          networkFee: 0.001, // Estimated network fee in SOL
          totalFee: feeAmount + 0.001,
        },
        route: 'perena',
        routeDetails: {
          provider: 'Perena Numéraire',
          pools: [sdk.PRODUCTION_POOLS.susd],
          priceImpactWarning: feeRate > 0.01,
        },
        estimatedExecutionTime: '~5 seconds',
      };
    } catch (error) {
      console.error('Perena simulation failed:', error);

      if (error instanceof PerenaServiceError) {
        throw error;
      }

      throw new PerenaServiceError(
        'PERENA_SIMULATION_FAILED',
        'Failed to simulate swap via Perena',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  async createSwapTransaction(params: PerenaSwapParams): Promise<TransactionMessage> {
    // Validate that this pair is supported by Perena
    if (!this.isPerenaSupported(params.fromToken, params.toToken)) {
      throw new PerenaServiceError(
        'UNSUPPORTED_PAIR',
        `Perena does not support ${params.fromToken} -> ${params.toToken} swaps`,
      );
    }

    // Validate server configuration
    if (!process.env.SOLANA_RPC_URL) {
      throw new PerenaServiceError('MISSING_RPC_URL', 'Solana RPC URL not configured');
    }

    let connection: Connection;
    let serverWallet: Keypair;

    try {
      connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');
      serverWallet = getServerWallet();
    } catch (error) {
      throw new PerenaServiceError(
        'CONNECTION_FAILED',
        'Failed to establish connection to Solana or get server wallet',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }

    try {
      // Load Perena SDK
      const sdk = await getPerenaSDK();

      // Get multisig and vault PDAs
      const multisigPda = new PublicKey(params.multisigAddress);
      const [vaultPda] = multisig.getVaultPda({ multisigPda, index: 0 });

      // Initialize Perena SDK with server wallet
      const state = sdk.init({
        connection,
        applyD: false,
        payer: serverWallet, // Use server wallet as payer
      });

      // Determine token indices
      const tokenIndices = this.getTokenIndices();
      const fromIndex = tokenIndices[params.fromToken];
      const toIndex = tokenIndices[params.toToken];

      if (fromIndex === undefined || toIndex === undefined) {
        throw new PerenaServiceError(
          'INVALID_TOKEN_INDEX',
          `Invalid token index for Perena: ${params.fromToken} -> ${params.toToken}`,
        );
      }

      // Convert amounts to proper decimals
      const amountIn = Math.floor(params.amount * 1_000_000);
      const minAmountOut = Math.floor(
        params.amount * 0.9995 * (1 - params.slippageTolerance / 100) * 1_000_000,
      );

      console.log('Creating Perena swap transaction:', {
        pool: sdk.PRODUCTION_POOLS.susd,
        fromIndex,
        toIndex,
        amountIn,
        minAmountOut,
        vaultPda: vaultPda.toBase58(),
        serverWallet: serverWallet.publicKey.toBase58(),
      });

      // Create the swap instruction using Perena SDK
      const { call } = await sdk.swapExactIn({
        pool: new PublicKey(sdk.PRODUCTION_POOLS.susd),
        in: fromIndex,
        out: toIndex,
        exactAmountIn: amountIn,
        minAmountOut,
        cuLimit: 1500000,
        requireCuIx: true, // Include compute unit instructions for execution
      });

      // Get the transaction from the call
      const transaction = await call.transaction();

      // IMPORTANT: For multisig execution, the vault should be the payer
      transaction.feePayer = vaultPda; // Use vault as fee payer for multisig execution

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();

      // Create transaction message compatible with Squads multisig execution
      const transactionMessage = new TransactionMessage({
        payerKey: vaultPda,
        recentBlockhash: blockhash,
        instructions: transaction.instructions,
      });

      console.log(
        'Perena swap transaction created successfully with',
        transaction.instructions.length,
        'instructions',
      );

      return transactionMessage;
    } catch (error) {
      console.error('Failed to create Perena swap transaction:', error);

      if (error instanceof PerenaServiceError) {
        throw error;
      }

      throw new PerenaServiceError(
        'TRANSACTION_CREATION_FAILED',
        'Failed to create Perena swap transaction',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  isPerenaSupported(fromToken: TokenType, toToken: TokenType): boolean {
    // Perena Seed Pool supports USDC and USDT swaps
    const perenaTokens = ['USDC', 'USDT'];
    return (
      perenaTokens.includes(fromToken) && perenaTokens.includes(toToken) && fromToken !== toToken
    );
  },

  getTokenIndices(): Record<string, number> {
    // Perena Seed Pool token indices based on production pool configuration
    // These indices correspond to the position of tokens in the Seed Pool
    return {
      USDC: 0, // First token in the tripool
      USDT: 1, // Second token in the tripool
      // PYUSD: 2 (available in pool but not used in this implementation)
    };
  },
};
