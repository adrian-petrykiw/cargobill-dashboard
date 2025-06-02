// services/api/swapApi.ts
import axios from 'axios';
import type { ApiResponse } from '@/types/api/responses';
import { TokenType } from '@/types/token';

export interface SwapSimulationParams {
  organizationId: string;
  fromToken: TokenType;
  toToken: TokenType;
  amount: number;
  slippageTolerance?: number; // Default 0.5%
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

// New interface for transaction preparation
export interface SwapPreparationParams {
  organizationId: string;
  fromToken: TokenType;
  toToken: TokenType;
  amount: number;
  slippageTolerance: number;
  expectedAmountOut: number;
  maxSlippageDeviation?: number;
}

// Response from preparation endpoint
export interface SwapPreparationResult {
  serializedTransaction: string; // Base64 encoded unsigned transaction
  transactionId: string; // Unique identifier for validation
  feePayerAddress: string; // Server wallet address for verification
  expiresAt: number; // Timestamp when transaction expires
  swapDetails: {
    fromToken: TokenType;
    toToken: TokenType;
    amountIn: number;
    expectedAmountOut: number;
    route: 'perena' | 'jupiter';
  };
}

// Updated execution params for sponsored transactions
export interface SwapExecutionParams {
  organizationId: string;
  transactionId: string; // From preparation step
  serializedSignedTransaction: string; // Base64 encoded transaction signed by user
}

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
  executionSignature: string; // To lookup stored context
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

export const swapApi = {
  async simulateSwap(params: SwapSimulationParams): Promise<SwapSimulationResult> {
    try {
      console.log('Making API request to /api/swap/simulate with params:', params);

      const { data } = await axios.post<ApiResponse<SwapSimulationResult>>(
        '/api/swap/simulate',
        params,
      );

      console.log('Swap simulation response received:', data);

      if (!data.success) {
        const errorMessage = data.error?.message || 'Failed to simulate swap';
        console.error('API returned error:', data.error);
        throw new Error(errorMessage);
      }

      if (!data.data) {
        throw new Error('No simulation data received from API');
      }

      return data.data;
    } catch (error) {
      console.error('Error simulating swap:', error);
      throw this.handleAxiosError(error, 'simulate');
    }
  },

  async prepareSwap(params: SwapPreparationParams): Promise<SwapPreparationResult> {
    try {
      console.log('Making API request to /api/swap/prepare with params:', params);

      const { data } = await axios.post<ApiResponse<SwapPreparationResult>>(
        '/api/swap/prepare',
        params,
      );

      console.log('Swap preparation response received:', data);

      if (!data.success) {
        const errorMessage = data.error?.message || 'Failed to prepare swap';
        console.error('API returned error:', data.error);
        throw new Error(errorMessage);
      }

      if (!data.data) {
        throw new Error('No preparation data received from API');
      }

      return data.data;
    } catch (error) {
      console.error('Error preparing swap:', error);
      throw this.handleAxiosError(error, 'prepare');
    }
  },

  async executeSwap(params: SwapExecutionParams): Promise<SwapExecutionResult> {
    try {
      console.log('Making API request to /api/swap/execute with params:', {
        organizationId: params.organizationId,
        transactionId: params.transactionId,
        // Don't log the full signed transaction for security
        hasSignedTransaction: !!params.serializedSignedTransaction,
      });

      const { data } = await axios.post<ApiResponse<SwapExecutionResult>>(
        '/api/swap/execute',
        params,
      );

      console.log('Swap execution response received:', data);

      if (!data.success) {
        const errorMessage = data.error?.message || 'Failed to execute swap';
        console.error('API returned error:', data.error);
        throw new Error(errorMessage);
      }

      if (!data.data) {
        throw new Error('No execution data received from API');
      }

      return data.data;
    } catch (error) {
      console.error('Error executing swap:', error);
      throw this.handleAxiosError(error, 'execute');
    }
  },

  async finalizeSwap(params: SwapFinalizationParams): Promise<SwapFinalizationResult> {
    try {
      console.log('Making API request to /api/swap/finalize');

      const { data } = await axios.post<ApiResponse<SwapFinalizationResult>>(
        '/api/swap/finalize',
        params,
      );

      console.log('Swap finalization response received:', data);

      if (!data.success) {
        const errorMessage = data.error?.message || 'Failed to finalize swap';
        console.error('API returned error:', data.error);
        throw new Error(errorMessage);
      }

      if (!data.data) {
        throw new Error('No finalization data received from API');
      }

      return data.data;
    } catch (error) {
      console.error('Error finalizing swap:', error);
      throw this.handleAxiosError(error, 'finalize');
    }
  },
  handleAxiosError(error: any, operation: string): Error {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        if (error.response?.data?.error?.code === 'ORGANIZATION_NOT_FOUND') {
          return new Error('No organization found. Please complete business registration first.');
        } else if (error.response?.data?.error?.code === 'TRANSACTION_NOT_FOUND') {
          return new Error('Transaction expired or not found. Please try again.');
        } else if (error.response?.data?.error?.code === 'INSUFFICIENT_BALANCE') {
          return new Error('Insufficient balance for this swap.');
        } else if (error.response?.data?.error?.code === 'SWAP_PAIR_NOT_SUPPORTED') {
          return new Error('This token pair is not currently supported for swapping.');
        } else {
          return new Error('Swap service not found. Please contact support.');
        }
      } else if (error.response?.status === 400) {
        if (error.response?.data?.error?.code === 'INVALID_SWAP_AMOUNT') {
          return new Error('Invalid swap amount. Please enter a valid amount.');
        } else if (error.response?.data?.error?.code === 'SLIPPAGE_TOO_HIGH') {
          return new Error('Slippage tolerance too high. Please reduce and try again.');
        } else if (error.response?.data?.error?.code === 'MARKET_CONDITIONS_CHANGED') {
          return new Error('Market conditions changed significantly. Please get a new quote.');
        } else if (error.response?.data?.error?.code === 'TRANSACTION_TAMPERED') {
          return new Error('Transaction validation failed. Please try again.');
        } else if (error.response?.data?.error?.code === 'TRANSACTION_EXPIRED') {
          return new Error('Transaction expired. Please create a new swap.');
        } else if (error.response?.data?.error?.code === 'INVALID_SIGNATURE') {
          return new Error('Invalid transaction signature. Please try again.');
        } else {
          return new Error(error.response.data.error?.message || 'Bad request');
        }
      } else if (error.response?.data?.error?.message) {
        return new Error(error.response.data.error.message);
      } else {
        return new Error(`Request failed: ${error.response?.status || 'Unknown error'}`);
      }
    }

    // If error is already an Error instance, return it
    if (error instanceof Error) {
      return error;
    }

    return new Error(`Failed to ${operation} swap. Please check your connection and try again.`);
  },
};
