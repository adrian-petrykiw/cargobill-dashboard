// services/api/paymentApi.ts
import axios from 'axios';
import type { ApiResponse } from '@/types/api/responses';

export interface CreatePaymentTransactionRequest {
  organizationId: string;
  invoice: {
    number: string;
    amount: number;
    index: number;
    totalInvoices: number;
  };
  tokenType: 'USDC' | 'USDT' | 'EURC';
  vendorMultisigAddress: string;
  transferMessage: {
    payerKey: string;
    recentBlockhash: string;
    instructions: any[];
  };
  memo: string;
  includeTransactionFee: boolean;
}

export interface CreatePaymentTransactionResponse {
  createTransaction: string;
  proposeTransaction: string;
  executeTransaction: string;
  transactionIndex: string;
  multisigAddress: string;
  vaultAddress: string;
  blockhash: string;
  lastValidBlockHeight: number;
}

export interface SecureSubmitTransactionRequest {
  serializedTransaction: string;
  expectedFeeAmount: number;
  tokenMint: string;
  organizationId: string;
  feeCollectionSignature: string;
}

export interface SecureSubmitTransactionResponse {
  signature: string;
  message: string;
  feeCollectionSignature: string;
}

class PaymentService {
  /**
   * Step 1: Create payment transaction on backend with secure server wallet as fee payer
   * Returns unsigned transactions for user to sign
   */
  async createPaymentTransaction(
    request: CreatePaymentTransactionRequest,
  ): Promise<CreatePaymentTransactionResponse> {
    try {
      console.log('🔒 Creating secure payment transaction via backend:', {
        organizationId: request.organizationId,
        invoice: request.invoice.number,
        tokenType: request.tokenType,
        includeTransactionFee: request.includeTransactionFee,
      });

      const { data } = await axios.post<ApiResponse<CreatePaymentTransactionResponse>>(
        '/api/transactions/create-payment',
        request,
      );

      console.log('Backend transaction creation response:', {
        success: data.success,
        hasData: !!data.data,
      });

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to create payment transaction');
      }

      if (!data.data) {
        throw new Error('No transaction data returned from backend');
      }

      console.log('✅ Payment transaction created successfully on backend:', {
        transactionIndex: data.data.transactionIndex,
        multisigAddress: data.data.multisigAddress,
        vaultAddress: data.data.vaultAddress,
      });

      return data.data;
    } catch (error) {
      console.error('❌ Error creating payment transaction:', error);

      if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
        throw new Error(error.response.data.error.message);
      }

      throw new Error('Failed to create payment transaction. Please try again.');
    }
  }

  /**
   * Step 2: Submit user-signed transaction to backend for server wallet signing and submission
   */
  async submitSignedTransaction(
    request: SecureSubmitTransactionRequest,
  ): Promise<SecureSubmitTransactionResponse> {
    try {
      console.log('🔒 Submitting signed transaction to backend for server wallet signing:', {
        expectedFeeAmount: request.expectedFeeAmount,
        tokenMint: request.tokenMint,
        organizationId: request.organizationId,
        feeCollectionSignature: request.feeCollectionSignature,
      });

      const { data } = await axios.post<ApiResponse<SecureSubmitTransactionResponse>>(
        '/api/transactions/sponsor',
        request,
      );

      console.log('Backend transaction submission response:', {
        success: data.success,
        hasData: !!data.data,
      });

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to submit signed transaction');
      }

      if (!data.data) {
        throw new Error('No transaction result returned from backend');
      }

      console.log('✅ Transaction submitted and confirmed successfully:', data.data.signature);
      return data.data;
    } catch (error) {
      console.error('❌ Error submitting signed transaction:', error);

      if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
        throw new Error(error.response.data.error.message);
      }

      throw new Error('Failed to submit transaction. Please try again.');
    }
  }

  /**
   * Helper method to process a complete payment transaction flow
   */
  async processPaymentTransaction(
    createRequest: CreatePaymentTransactionRequest,
    userWallet: any, // ConnectedSolanaWallet type
  ): Promise<{
    createResult: SecureSubmitTransactionResponse;
    proposeResult: SecureSubmitTransactionResponse;
    executeResult: SecureSubmitTransactionResponse;
  }> {
    try {
      console.log('🔄 Starting complete secure payment transaction flow');

      // Step 1: Create transactions on backend
      const createResponse = await this.createPaymentTransaction(createRequest);

      // Step 2: Get token mint for requests
      const tokenMint =
        createRequest.tokenType === 'USDC'
          ? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
          : createRequest.tokenType === 'USDT'
            ? 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
            : createRequest.tokenType === 'EURC'
              ? 'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr'
              : (() => {
                  throw new Error(`Unsupported token type: ${createRequest.tokenType}`);
                })();

      // Import VersionedTransaction here to avoid issues
      const { VersionedTransaction } = await import('@solana/web3.js');

      // Step 3: User signs CREATE transaction
      console.log('👤 User signing CREATE transaction...');
      const createTxBuffer = Buffer.from(createResponse.createTransaction, 'base64');
      const createTx = VersionedTransaction.deserialize(createTxBuffer);
      const signedCreateTx = await userWallet.signTransaction(createTx);

      // Step 4: Submit CREATE transaction
      console.log('📤 Submitting CREATE transaction...');
      const createResult = await this.submitSignedTransaction({
        serializedTransaction: Buffer.from(signedCreateTx.serialize()).toString('base64'),
        expectedFeeAmount: 15,
        tokenMint,
        organizationId: createRequest.organizationId,
        feeCollectionSignature: 'integrated-in-main-transaction',
      });

      // Step 5: Wait between transactions
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Step 6: User signs PROPOSE transaction
      console.log('👤 User signing PROPOSE + APPROVE transaction...');
      const proposeTxBuffer = Buffer.from(createResponse.proposeTransaction, 'base64');
      const proposeTx = VersionedTransaction.deserialize(proposeTxBuffer);
      const signedProposeTx = await userWallet.signTransaction(proposeTx);

      // Step 7: Submit PROPOSE transaction
      console.log('📤 Submitting PROPOSE + APPROVE transaction...');
      const proposeResult = await this.submitSignedTransaction({
        serializedTransaction: Buffer.from(signedProposeTx.serialize()).toString('base64'),
        expectedFeeAmount: 15,
        tokenMint,
        organizationId: createRequest.organizationId,
        feeCollectionSignature: 'integrated-in-main-transaction',
      });

      // Step 8: Wait before execution
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Step 9: Create execution transaction (this needs to be created dynamically)
      // For now, we'll use the executeTransaction from the response, but this might need updating
      console.log('👤 User signing EXECUTE transaction...');
      const executeTxBuffer = Buffer.from(createResponse.executeTransaction, 'base64');
      const executeTx = VersionedTransaction.deserialize(executeTxBuffer);
      const signedExecuteTx = await userWallet.signTransaction(executeTx);

      // Step 10: Submit EXECUTE transaction
      console.log('📤 Submitting EXECUTE transaction...');
      const executeResult = await this.submitSignedTransaction({
        serializedTransaction: Buffer.from(signedExecuteTx.serialize()).toString('base64'),
        expectedFeeAmount: 15,
        tokenMint,
        organizationId: createRequest.organizationId,
        feeCollectionSignature: 'integrated-in-main-transaction',
      });

      console.log('✅ Complete payment transaction flow successful');

      return {
        createResult,
        proposeResult,
        executeResult,
      };
    } catch (error) {
      console.error('❌ Error in complete payment transaction flow:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const paymentService = new PaymentService();
