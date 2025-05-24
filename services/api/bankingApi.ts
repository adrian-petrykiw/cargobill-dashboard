// services/api/bankingApi.ts
import axios from 'axios';
import type {
  AccountDetail,
  TransfersResponse,
  TransferHistoryParams,
  TransactionsResponse,
  transformTransactionsToTransfers,
} from '@/schemas/banking.schema';
import { transformTransactionsToTransfers as transformFunction } from '@/schemas/banking.schema';
import type { ApiResponse } from '@/types/api/responses';

export const bankingApi = {
  async getAccountInfo(): Promise<AccountDetail> {
    try {
      console.log('Making API request to /api/banking/account-info');
      const { data } = await axios.get<ApiResponse<AccountDetail>>('/api/banking/account-info');

      console.log('API response received:', data);

      if (!data.success) {
        const errorMessage = data.error?.message || 'Failed to fetch account info';
        console.error('API returned error:', data.error);
        throw new Error(errorMessage);
      }

      if (!data.data) {
        throw new Error('No account data received from API');
      }

      return data.data;
    } catch (error) {
      console.error('Error fetching account info:', error);

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          if (error.response?.data?.error?.code === 'ORGANIZATION_NOT_FOUND') {
            throw new Error('No organization found. Please complete business registration first.');
          } else if (error.response?.data?.error?.code === 'FBO_ACCOUNT_NOT_CONFIGURED') {
            throw new Error(
              'Banking not configured. Please contact support to set up your bank account.',
            );
          } else {
            throw new Error('Banking service not found. Please contact support.');
          }
        } else if (error.response?.data?.error?.message) {
          throw new Error(error.response.data.error.message);
        } else {
          throw new Error(`Request failed: ${error.response?.status || 'Unknown error'}`);
        }
      }

      throw new Error(
        'Failed to fetch account information. Please check your connection and try again.',
      );
    }
  },

  async getTransferHistory(params?: TransferHistoryParams): Promise<TransfersResponse> {
    try {
      console.log('Making API request to /api/banking/transactions with params:', params);
      const { data } = await axios.get<ApiResponse<TransactionsResponse>>(
        '/api/banking/transactions',
        {
          params,
        },
      );

      console.log('API response received:', data);

      if (!data.success) {
        const errorMessage = data.error?.message || 'Failed to fetch transfers';
        console.error('API returned error:', data.error);
        throw new Error(errorMessage);
      }

      // Handle case where data.data might be null or undefined
      const transactionsResponse = data.data || { values: [] };
      console.log('Transforming transactions response:', transactionsResponse);

      // Transform backend transactions to frontend transfers with error handling
      const transfersResponse = transformFunction(transactionsResponse);
      console.log('Transformed to transfers response:', transfersResponse);

      return transfersResponse;
    } catch (error) {
      console.error('Error fetching transfer history:', error);

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          if (error.response?.data?.error?.code === 'ORGANIZATION_NOT_FOUND') {
            throw new Error('No organization found. Please complete business registration first.');
          } else if (error.response?.data?.error?.code === 'FBO_ACCOUNT_NOT_CONFIGURED') {
            throw new Error(
              'Banking not configured. Please contact support to set up your bank account.',
            );
          } else {
            throw new Error('Banking service not found. Please contact support.');
          }
        } else if (error.response?.data?.error?.message) {
          throw new Error(error.response.data.error.message);
        } else {
          throw new Error(`Request failed: ${error.response?.status || 'Unknown error'}`);
        }
      }

      // If it's a transformation error, return empty results instead of throwing
      if (error instanceof Error && error.message.includes('Cannot read properties')) {
        console.warn('Transformation error, returning empty transfers:', error);
        return { values: [] };
      }

      throw new Error(
        'Failed to fetch transfer history. Please check your connection and try again.',
      );
    }
  },
};
