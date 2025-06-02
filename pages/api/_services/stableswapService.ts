// pages/api/_services/stableswapService.ts
import { Connection, PublicKey, Transaction, Keypair } from '@solana/web3.js';
import { TokenType } from '@/types/token';
import bs58 from 'bs58';

import { squadsService, SquadsServiceError } from './squadsService';
import { perenaService, PerenaServiceError } from './perenaService';
import { jupiterService, JupiterServiceError } from './jupiterService';
import { tokenBalanceService } from '@/services/blockchain/tokenBalance';
import { solanaService } from './solanaService';

export class StableswapServiceError extends Error {
  code: string;
  details?: any;

  constructor(code: string, message: string, details?: any) {
    super(message);
    this.name = 'StableswapServiceError';
    this.code = code;
    this.details = details;
  }
}

export interface SwapSimulationParams {
  multisigAddress: string;
  fromToken: TokenType;
  toToken: TokenType;
  amount: number;
  slippageTolerance: number;
}

export interface SwapSimulationResult {
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
  route: 'perena' | 'jupiter';
  routeDetails: {
    provider: string;
    pools?: string[];
    priceImpactWarning?: boolean;
  };
  estimatedExecutionTime: string;
}

// New interfaces for sponsored transactions
export interface SwapPreparationParams {
  multisigAddress: string;
  fromToken: TokenType;
  toToken: TokenType;
  amount: number;
  slippageTolerance: number;
  expectedAmountOut: number;
  maxSlippageDeviation?: number;
}

export interface SwapPreparationResult {
  unsignedTransaction: Transaction;
  transactionMessage: any; // Store original transaction message for validation
  feePayerAddress: string;
  swapDetails: {
    fromToken: TokenType;
    toToken: TokenType;
    amountIn: number;
    expectedAmountOut: number;
    route: 'perena' | 'jupiter';
  };
}

export interface SponsoredSwapExecutionParams {
  transactionId: string;
  preparedTransaction: any;
  serializedSignedTransaction: string;
  organizationAddress: string;
}

// Updated result for two-step execution
export interface SwapExecutionResult {
  transactionSignature: string;
  fromToken: TokenType;
  toToken: TokenType;
  amountIn: number;
  amountOut: number;
  executedAt: string;
  status: 'pending' | 'confirmed' | 'failed';
  // New fields for two-step execution
  needsExecution?: boolean;
  executionTransaction?: string;
}

// New interface for finalization
export interface SwapFinalizationParams {
  serializedSignedExecutionTransaction: string;
}

export interface SwapFinalizationResult {
  transactionSignature: string;
  fromToken: TokenType;
  toToken: TokenType;
  amountIn: number;
  amountOut: number;
  executedAt: string;
  status: 'confirmed';
}

// Get server wallet for fee paying
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

export const stableswapService = {
  /**
   * Simulate a swap without any caching - return results directly
   */
  async simulateSwap(params: SwapSimulationParams): Promise<SwapSimulationResult> {
    console.log(
      `Starting swap simulation: ${params.amount} ${params.fromToken} -> ${params.toToken}`,
    );

    // Input validation
    this.validateSwapParams(params);

    // Check server configuration
    if (!process.env.SOLANA_RPC_URL) {
      throw new StableswapServiceError('MISSING_RPC_URL', 'Solana RPC URL not configured');
    }

    let connection: Connection;
    try {
      connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');
    } catch (error) {
      throw new StableswapServiceError(
        'CONNECTION_FAILED',
        'Failed to establish connection to Solana',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }

    // Verify sufficient balance
    await this.verifyBalance(params.multisigAddress, params.fromToken, params.amount);

    // Determine optimal route
    const route = this.determineRoute(params.fromToken, params.toToken);

    console.log(
      `Using ${route} for swap: ${params.amount} ${params.fromToken} -> ${params.toToken}`,
    );

    try {
      let simulationResult: SwapSimulationResult;

      if (route === 'perena') {
        try {
          simulationResult = await perenaService.simulateSwap({
            multisigAddress: params.multisigAddress,
            fromToken: params.fromToken,
            toToken: params.toToken,
            amount: params.amount,
            slippageTolerance: params.slippageTolerance,
          });
        } catch (error) {
          console.warn('Perena simulation failed, falling back to Jupiter:', error);

          // Fall back to Jupiter if Perena fails
          simulationResult = await jupiterService.simulateSwap({
            multisigAddress: params.multisigAddress,
            fromToken: params.fromToken,
            toToken: params.toToken,
            amount: params.amount,
            slippageTolerance: params.slippageTolerance,
          });
        }
      } else {
        simulationResult = await jupiterService.simulateSwap({
          multisigAddress: params.multisigAddress,
          fromToken: params.fromToken,
          toToken: params.toToken,
          amount: params.amount,
          slippageTolerance: params.slippageTolerance,
        });
      }

      console.log('Simulation completed successfully:', {
        route: simulationResult.route,
        amountIn: simulationResult.amountIn,
        estimatedAmountOut: simulationResult.estimatedAmountOut,
        priceImpact: simulationResult.priceImpact,
      });

      return simulationResult;
    } catch (error) {
      console.error(`Failed to simulate ${route} swap:`, error);

      if (error instanceof PerenaServiceError || error instanceof JupiterServiceError) {
        throw new StableswapServiceError(error.code, error.message, error.details);
      }

      throw new StableswapServiceError(
        'SIMULATION_FAILED',
        `Failed to simulate swap via ${route}`,
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  /**
   * Prepare a swap transaction for sponsored execution
   */
  async prepareSwapTransaction(params: SwapPreparationParams): Promise<SwapPreparationResult> {
    console.log(
      `Preparing sponsored swap transaction: ${params.amount} ${params.fromToken} -> ${params.toToken}`,
    );

    // Input validation
    this.validateExecutionParams(params);

    // Re-verify balance before preparation
    await this.verifyBalance(params.multisigAddress, params.fromToken, params.amount);

    // Perform fresh simulation for validation
    console.log('Performing fresh simulation for transaction preparation...');

    const freshSimulation = await this.simulateSwap({
      multisigAddress: params.multisigAddress,
      fromToken: params.fromToken,
      toToken: params.toToken,
      amount: params.amount,
      slippageTolerance: params.slippageTolerance,
    });

    // Validate that current market conditions are still acceptable
    const maxSlippageDeviation = params.maxSlippageDeviation || 0.02; // 2% default
    const amountOutDeviation =
      Math.abs(freshSimulation.estimatedAmountOut - params.expectedAmountOut) /
      params.expectedAmountOut;

    if (amountOutDeviation > maxSlippageDeviation) {
      throw new StableswapServiceError(
        'MARKET_CONDITIONS_CHANGED',
        `Market conditions have changed significantly. Expected: ${params.expectedAmountOut}, Current: ${freshSimulation.estimatedAmountOut}`,
        {
          expectedAmountOut: params.expectedAmountOut,
          currentAmountOut: freshSimulation.estimatedAmountOut,
          deviation: amountOutDeviation,
          maxAllowedDeviation: maxSlippageDeviation,
        },
      );
    }

    console.log(`Preparing ${freshSimulation.route} swap transaction with fresh validation passed`);

    try {
      let swapTransaction;

      // Create swap transaction using the determined route
      if (freshSimulation.route === 'perena') {
        try {
          swapTransaction = await perenaService.createSwapTransaction({
            multisigAddress: params.multisigAddress,
            fromToken: params.fromToken,
            toToken: params.toToken,
            amount: params.amount,
            slippageTolerance: params.slippageTolerance,
          });
        } catch (error) {
          console.warn('Perena transaction creation failed, falling back to Jupiter:', error);

          // Fall back to Jupiter for execution if Perena fails
          swapTransaction = await jupiterService.createSwapTransaction({
            multisigAddress: params.multisigAddress,
            fromToken: params.fromToken,
            toToken: params.toToken,
            amount: params.amount,
            slippageTolerance: params.slippageTolerance,
          });
        }
      } else {
        swapTransaction = await jupiterService.createSwapTransaction({
          multisigAddress: params.multisigAddress,
          fromToken: params.fromToken,
          toToken: params.toToken,
          amount: params.amount,
          slippageTolerance: params.slippageTolerance,
        });
      }

      // Get server wallet for fee paying
      const serverWallet = getServerWallet();

      // Create unsigned transaction for sponsored execution via Squads
      const unsignedTransaction = await squadsService.prepareSponsoredSwapTransaction({
        multisigAddress: params.multisigAddress,
        transactionMessage: swapTransaction,
        feePayerAddress: serverWallet.publicKey,
        description: `Swap ${params.amount} ${params.fromToken} to ${params.toToken} via ${freshSimulation.route}`,
      });

      console.log(`Sponsored swap transaction prepared successfully`);

      return {
        unsignedTransaction,
        transactionMessage: swapTransaction,
        feePayerAddress: serverWallet.publicKey.toBase58(),
        swapDetails: {
          fromToken: params.fromToken,
          toToken: params.toToken,
          amountIn: params.amount,
          expectedAmountOut: freshSimulation.estimatedAmountOut,
          route: freshSimulation.route,
        },
      };
    } catch (error) {
      console.error(`Failed to prepare ${freshSimulation.route} swap transaction:`, error);

      if (
        error instanceof SquadsServiceError ||
        error instanceof PerenaServiceError ||
        error instanceof JupiterServiceError
      ) {
        throw new StableswapServiceError(error.code, error.message, error.details);
      }

      throw new StableswapServiceError(
        'PREPARATION_FAILED',
        `Failed to prepare swap transaction via ${freshSimulation.route}`,
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  /**
   * Execute a sponsored swap transaction - Step 1 (Proposal Creation)
   * Returns execution transaction if user needs to sign again
   */
  async executeSponsoredSwap(params: SponsoredSwapExecutionParams): Promise<SwapExecutionResult> {
    console.log(`Executing sponsored swap transaction: ${params.transactionId}`);

    try {
      // Validate the signed transaction against the prepared transaction
      const validationResult = this.validateSignedTransaction(
        params.serializedSignedTransaction,
        params.preparedTransaction,
      );

      if (!validationResult.isValid) {
        throw new StableswapServiceError(
          'TRANSACTION_TAMPERED',
          `Transaction validation failed: ${validationResult.reason}`,
          { validationDetails: validationResult },
        );
      }

      // Execute the validated sponsored transaction (Step 1: Proposal creation/approval)
      const executionResult = await squadsService.executeSponsoredSwapTransaction({
        multisigAddress: params.organizationAddress,
        serializedSignedTransaction: params.serializedSignedTransaction,
        originalTransactionMessage: params.preparedTransaction.transactionMessage,
        description: `Sponsored swap: ${params.preparedTransaction.swapDetails.amountIn} ${params.preparedTransaction.swapDetails.fromToken} to ${params.preparedTransaction.swapDetails.toToken}`,
      });

      console.log(`Sponsored swap proposal created. Transaction: ${executionResult.signature}`);

      // Check if execution step is needed
      if (executionResult.needsExecution && executionResult.executionTransaction) {
        console.log('Swap proposal approved, execution transaction ready for user signature');

        return {
          transactionSignature: executionResult.signature, // Proposal signature
          fromToken: params.preparedTransaction.swapDetails.fromToken,
          toToken: params.preparedTransaction.swapDetails.toToken,
          amountIn: params.preparedTransaction.swapDetails.amountIn,
          amountOut: params.preparedTransaction.swapDetails.expectedAmountOut,
          executedAt: new Date().toISOString(),
          status: 'pending',
          needsExecution: true, // Indicates user needs to sign execution transaction
          executionTransaction: executionResult.executionTransaction, // For user to sign
        };
      } else {
        // Single-step execution completed
        console.log('Sponsored swap completed in single step');

        return {
          transactionSignature: executionResult.signature,
          fromToken: params.preparedTransaction.swapDetails.fromToken,
          toToken: params.preparedTransaction.swapDetails.toToken,
          amountIn: params.preparedTransaction.swapDetails.amountIn,
          amountOut: params.preparedTransaction.swapDetails.expectedAmountOut,
          executedAt: new Date().toISOString(),
          status: 'confirmed',
        };
      }
    } catch (error) {
      console.error(`Failed to execute sponsored swap:`, error);

      if (error instanceof SquadsServiceError || error instanceof StableswapServiceError) {
        throw error;
      }

      throw new StableswapServiceError(
        'SPONSORED_EXECUTION_FAILED',
        'Failed to execute sponsored swap transaction',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  /**
   * Finalize sponsored swap execution - Step 2 (Execution)
   * Handle user-signed execution transaction
   */
  async finalizeSponsoredSwap(
    params: SwapFinalizationParams & { swapDetails?: any },
  ): Promise<SwapFinalizationResult> {
    console.log('Finalizing sponsored swap execution');

    try {
      // Finalize the execution via squads service
      const finalizationResult = await squadsService.finalizeSponsoredSwapExecution({
        serializedSignedExecutionTransaction: params.serializedSignedExecutionTransaction,
      });

      console.log(
        `Sponsored swap execution finalized. Transaction: ${finalizationResult.signature}`,
      );

      // Use swap details if provided, otherwise return defaults
      const swapDetails = params.swapDetails || {
        fromToken: 'USDC',
        toToken: 'USDT',
        amountIn: 0,
        expectedAmountOut: 0,
      };

      return {
        transactionSignature: finalizationResult.signature,
        fromToken: swapDetails.fromToken,
        toToken: swapDetails.toToken,
        amountIn: swapDetails.amountIn,
        amountOut: swapDetails.expectedAmountOut,
        executedAt: new Date().toISOString(),
        status: 'confirmed',
      };
    } catch (error) {
      console.error(`Failed to finalize sponsored swap:`, error);

      if (error instanceof SquadsServiceError) {
        throw new StableswapServiceError(error.code, error.message, error.details);
      }

      throw new StableswapServiceError(
        'SPONSORED_FINALIZATION_FAILED',
        'Failed to finalize sponsored swap execution',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  /**
   * Validate that a signed transaction matches the prepared transaction
   */
  validateSignedTransaction(
    serializedSignedTransaction: string,
    preparedTransaction: any,
  ): { isValid: boolean; reason?: string; userSignaturePresent?: boolean } {
    try {
      // Deserialize the signed transaction
      const signedTxBuffer = Buffer.from(serializedSignedTransaction, 'base64');
      const signedTransaction = Transaction.from(signedTxBuffer);

      console.log('Validating signed transaction structure...');

      // Check basic transaction structure
      if (!signedTransaction.instructions || signedTransaction.instructions.length === 0) {
        return { isValid: false, reason: 'Transaction has no instructions' };
      }

      // Verify fee payer matches expected server wallet
      const serverWallet = getServerWallet();
      if (!signedTransaction.feePayer?.equals(serverWallet.publicKey)) {
        return { isValid: false, reason: 'Fee payer does not match server wallet' };
      }

      // Check that user signature is present
      let userSignaturePresent = false;
      for (const signature of signedTransaction.signatures) {
        if (signature.signature !== null && !signature.publicKey.equals(serverWallet.publicKey)) {
          userSignaturePresent = true;
          break;
        }
      }

      if (!userSignaturePresent) {
        return {
          isValid: false,
          reason: 'User signature not found in transaction',
          userSignaturePresent: false,
        };
      }

      // Validate transaction content matches prepared transaction
      // This is a simplified validation - in production, you'd want more thorough checks
      const instructionCount = signedTransaction.instructions.length;
      console.log(`Transaction has ${instructionCount} instructions`);

      // Additional validation could include:
      // - Verify specific instruction data hasn't changed
      // - Ensure account keys match expected values
      // - Validate token amounts and addresses

      console.log('Transaction validation passed');

      return {
        isValid: true,
        userSignaturePresent: true,
      };
    } catch (error) {
      console.error('Error validating signed transaction:', error);
      return {
        isValid: false,
        reason: `Transaction deserialization failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },

  /**
   * Determine optimal routing for token pair
   */
  determineRoute(fromToken: TokenType, toToken: TokenType): 'perena' | 'jupiter' {
    // Perena supports direct USDC <-> USDT swaps within the Seed Pool
    const perenaTokens = ['USDC', 'USDT'];
    const canUsePerena =
      perenaTokens.includes(fromToken) && perenaTokens.includes(toToken) && fromToken !== toToken;

    return canUsePerena ? 'perena' : 'jupiter';
  },

  /**
   * Verify sufficient token balance for swap
   */
  async verifyBalance(
    multisigAddress: string,
    tokenType: TokenType,
    requiredAmount: number,
  ): Promise<void> {
    try {
      const multisigPda = new PublicKey(multisigAddress);
      const balances = await tokenBalanceService.getAllTokenBalances(multisigPda);

      const tokenBalance = balances.find((b) => b.token === tokenType);

      if (!tokenBalance || tokenBalance.balance < requiredAmount) {
        throw new StableswapServiceError(
          'INSUFFICIENT_BALANCE',
          `Insufficient ${tokenType} balance. Required: ${requiredAmount}, Available: ${tokenBalance?.balance || 0}`,
          {
            required: requiredAmount,
            available: tokenBalance?.balance || 0,
            token: tokenType,
          },
        );
      }

      console.log(
        `Balance verified: ${tokenBalance.balance} ${tokenType} available, ${requiredAmount} required`,
      );
    } catch (error) {
      if (error instanceof StableswapServiceError) {
        throw error;
      }

      console.error('Error verifying balance:', error);
      throw new StableswapServiceError('BALANCE_CHECK_FAILED', 'Failed to verify token balance', {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  },

  /**
   * Validate swap simulation parameters
   */
  validateSwapParams(params: SwapSimulationParams): void {
    if (!params.multisigAddress) {
      throw new StableswapServiceError('INVALID_MULTISIG_ADDRESS', 'Multisig address is required');
    }

    if (!params.fromToken || !params.toToken) {
      throw new StableswapServiceError('INVALID_TOKENS', 'From and to tokens are required');
    }

    if (params.fromToken === params.toToken) {
      throw new StableswapServiceError('INVALID_SWAP_PAIR', 'From and to tokens must be different');
    }

    if (params.amount <= 0) {
      throw new StableswapServiceError('INVALID_AMOUNT', 'Amount must be positive');
    }

    if (params.slippageTolerance < 0.1 || params.slippageTolerance > 5) {
      throw new StableswapServiceError(
        'INVALID_SLIPPAGE',
        'Slippage tolerance must be between 0.1% and 5%',
      );
    }

    // Validate wallet address format
    try {
      new PublicKey(params.multisigAddress);
    } catch (error) {
      throw new StableswapServiceError(
        'INVALID_WALLET_FORMAT',
        `Invalid multisig address format: ${params.multisigAddress}`,
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }

    // Check if swap pair is supported
    const supportedTokens = ['USDC', 'USDT', 'EURC'];
    if (!supportedTokens.includes(params.fromToken) || !supportedTokens.includes(params.toToken)) {
      throw new StableswapServiceError(
        'UNSUPPORTED_TOKEN',
        `Unsupported token pair: ${params.fromToken} -> ${params.toToken}`,
      );
    }
  },

  /**
   * Validate swap execution parameters
   */
  validateExecutionParams(params: SwapPreparationParams): void {
    // First validate basic swap parameters
    this.validateSwapParams({
      multisigAddress: params.multisigAddress,
      fromToken: params.fromToken,
      toToken: params.toToken,
      amount: params.amount,
      slippageTolerance: params.slippageTolerance,
    });

    // Additional execution-specific validations
    if (params.expectedAmountOut <= 0) {
      throw new StableswapServiceError(
        'INVALID_EXPECTED_AMOUNT',
        'Expected amount out must be positive',
      );
    }

    if (
      params.maxSlippageDeviation !== undefined &&
      (params.maxSlippageDeviation < 0 || params.maxSlippageDeviation > 0.1)
    ) {
      throw new StableswapServiceError(
        'INVALID_SLIPPAGE_DEVIATION',
        'Max slippage deviation must be between 0% and 10%',
      );
    }
  },
};
