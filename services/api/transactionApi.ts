// services/api/transactionApi.ts
import axios from 'axios';
import type {
  Transaction,
  CreateTransactionRequest,
  StoreTransactionData,
  UpdateTransactionData,
} from '@/schemas/transaction.schema';
import type { ApiResponse } from '@/types/api/responses';

export interface SponsoredTransactionRequest {
  serializedTransaction: string;
  expectedFeeAmount: number;
  tokenMint: string;
  organizationId: string;
  feeCollectionSignature: string;
}

export interface SponsoredTransactionResponse {
  signature: string;
  message: string;
  feeCollectionSignature: string;
}

export const transactionApi = {
  // Store a new transaction after blockchain execution
  async storeTransaction(transactionData: StoreTransactionData): Promise<Transaction> {
    try {
      console.log('Storing transaction via API:', {
        signature: transactionData.signature,
        amount: transactionData.amount,
        payment_method: transactionData.payment_method,
        invoices_count: transactionData.invoices.length,
      });

      const { data } = await axios.post<ApiResponse<Transaction>>(
        '/api/transactions/store',
        transactionData,
      );

      console.log('Store transaction API response:', {
        success: data.success,
        hasData: !!data.data,
        dataType: typeof data.data,
      });

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to store transaction');
      }

      if (!data.data) {
        throw new Error('No transaction data returned from server');
      }

      console.log('Transaction stored successfully:', data.data.id);
      return data.data;
    } catch (error) {
      console.error('Error storing transaction:', error);
      if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
        throw new Error(error.response.data.error.message);
      }
      throw new Error('Failed to store transaction. Please try again later.');
    }
  },

  // Submit sponsored transaction (with integrated fee collection)
  async submitSponsoredTransaction(
    request: SponsoredTransactionRequest,
  ): Promise<SponsoredTransactionResponse> {
    try {
      const isIntegratedFee = request.feeCollectionSignature === 'integrated-in-main-transaction';

      console.log('Submitting sponsored transaction:', {
        expectedFeeAmount: request.expectedFeeAmount,
        tokenMint: request.tokenMint,
        organizationId: request.organizationId,
        feeApproach: isIntegratedFee ? 'integrated' : 'legacy_separate',
        feeCollectionSignature: isIntegratedFee
          ? 'integrated'
          : request.feeCollectionSignature.substring(0, 8) + '...',
      });

      const { data } = await axios.post<ApiResponse<SponsoredTransactionResponse>>(
        '/api/transactions/sponsor',
        request,
      );

      console.log('Sponsored transaction API response:', {
        success: data.success,
        hasData: !!data.data,
      });

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to complete sponsored transaction');
      }

      if (!data.data) {
        throw new Error('No sponsored transaction data returned from server');
      }

      console.log('Sponsored transaction completed successfully:', data.data.signature);
      return data.data;
    } catch (error) {
      console.error('Error submitting sponsored transaction:', error);
      if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
        throw new Error(error.response.data.error.message);
      }
      throw new Error('Failed to complete sponsored transaction. Please try again later.');
    }
  },

  // Get transaction by ID
  async getTransactionById(id: string): Promise<Transaction> {
    try {
      console.log('Fetching transaction by ID:', id);

      const { data } = await axios.get<ApiResponse<Transaction>>(`/api/transactions/${id}`);

      console.log('Get transaction API response:', {
        success: data.success,
        hasData: !!data.data,
        dataType: typeof data.data,
      });

      if (!data.success) throw new Error(data.error?.message || 'Failed to fetch transaction');
      if (!data.data) throw new Error('No transaction data returned from server');

      return data.data;
    } catch (error) {
      console.error('Error fetching transaction by ID:', error);
      if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
        throw new Error(error.response.data.error.message);
      }
      throw new Error('Failed to fetch transaction. Please try again later.');
    }
  },

  // Update transaction
  async updateTransaction(id: string, updateData: UpdateTransactionData): Promise<Transaction> {
    try {
      console.log('Updating transaction via API:', {
        id,
        updates: Object.keys(updateData),
        payment_method: updateData.payment_method,
      });

      const { data } = await axios.put<ApiResponse<Transaction>>(
        `/api/transactions/${id}`,
        updateData,
      );

      console.log('Update transaction API response:', {
        success: data.success,
        hasData: !!data.data,
        dataType: typeof data.data,
      });

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to update transaction');
      }

      if (!data.data) {
        throw new Error('No transaction data returned from server');
      }

      console.log('Transaction updated successfully:', data.data.id);
      return data.data;
    } catch (error) {
      console.error('Error updating transaction:', error);
      if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
        throw new Error(error.response.data.error.message);
      }
      throw new Error('Failed to update transaction. Please try again later.');
    }
  },

  // Get all transactions for an organization
  async getOrganizationTransactions(organizationId: string): Promise<Transaction[]> {
    try {
      console.log('Fetching organization transactions for:', organizationId);

      const { data } = await axios.get<ApiResponse<Transaction[]>>(
        `/api/transactions/organization/${organizationId}`,
      );

      console.log('Organization transactions API response:', {
        success: data.success,
        hasData: !!data.data,
        dataType: typeof data.data,
        isArray: Array.isArray(data.data),
        length: Array.isArray(data.data) ? data.data.length : 'N/A',
      });

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to fetch organization transactions');
      }

      // DEFENSIVE: Ensure we always return an array
      if (!data.data) {
        console.warn('No data returned from organization transactions API, returning empty array');
        return [];
      }

      if (!Array.isArray(data.data)) {
        console.error('Organization transactions API returned non-array data:', data.data);
        return [];
      }

      console.log(`Successfully fetched ${data.data.length} organization transactions`);
      return data.data;
    } catch (error) {
      console.error('Error fetching organization transactions:', error);
      if (axios.isAxiosError(error)) {
        console.error('Axios error details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        });

        if (error.response?.data?.error?.message) {
          throw new Error(error.response.data.error.message);
        }
      }
      throw new Error('Failed to fetch transactions. Please try again later.');
    }
  },

  // Update transaction status
  async updateTransactionStatus(id: string, status: string): Promise<Transaction> {
    try {
      console.log('Updating transaction status:', { id, status });

      const { data } = await axios.put<ApiResponse<Transaction>>(`/api/transactions/${id}/status`, {
        status,
      });

      console.log('Update status API response:', {
        success: data.success,
        hasData: !!data.data,
        dataType: typeof data.data,
      });

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to update transaction status');
      }

      if (!data.data) {
        throw new Error('No transaction data returned from server');
      }

      return data.data;
    } catch (error) {
      console.error('Error updating transaction status:', error);
      if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
        throw new Error(error.response.data.error.message);
      }
      throw new Error('Failed to update transaction status. Please try again later.');
    }
  },

  // Complete a transaction
  async completeTransaction(id: string): Promise<Transaction> {
    try {
      console.log('Completing transaction:', id);

      const { data } = await axios.put<ApiResponse<Transaction>>(
        `/api/transactions/${id}/complete`,
      );

      console.log('Complete transaction API response:', {
        success: data.success,
        hasData: !!data.data,
        dataType: typeof data.data,
      });

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to complete transaction');
      }

      if (!data.data) {
        throw new Error('No transaction data returned from server');
      }

      return data.data;
    } catch (error) {
      console.error('Error completing transaction:', error);
      if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
        throw new Error(error.response.data.error.message);
      }
      throw new Error('Failed to complete transaction. Please try again later.');
    }
  },
};
