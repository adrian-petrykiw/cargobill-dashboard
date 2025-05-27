// services/api/transactionApi.ts
import axios from 'axios';
import type { Transaction, CreateTransactionRequest } from '@/schemas/transaction.schema';
import type { ApiResponse } from '@/types/api/responses';

// Type for the transaction data that comes from the TransactionConfirmation component
export type StoreTransactionData = {
  organization_id: string;
  signature: string;
  token_mint: string;
  proof_data: {
    encryption_keys: Record<string, string>;
    memo_hashes: Record<string, string>;
    file_hashes: Record<string, string[]>;
    comprehensive_encrypted_data: Record<string, string>;
    essential_data_used: Record<string, any>;
  };
  amount: number;
  transaction_type: 'payment' | 'transfer' | 'request' | 'other';
  sender: {
    multisig_address: string;
    vault_address: string;
    wallet_address: string;
  };
  recipient: {
    multisig_address: string;
    vault_address: string;
  };
  invoices: Array<{
    number: string;
    amount: number;
    file_count?: number;
  }>;
  status: string;
  restricted_payment_methods?: string[];
  metadata?: {
    custom_fields?: Record<string, any>;
    payment_date?: string;
    additional_info?: string;
    files_processed?: number;
    memo_approach?: string;
    memo_data_size?: number;
    memo_hash_length?: number;
    data_structure_consistency?: Record<string, any>;
  };
  recipient_organization_id?: string;
  sender_name?: string;
  recipient_name?: string;
};

export const transactionApi = {
  // Store a new transaction after blockchain execution
  async storeTransaction(transactionData: StoreTransactionData): Promise<Transaction> {
    try {
      console.log('Storing transaction via API:', {
        signature: transactionData.signature,
        amount: transactionData.amount,
        invoices_count: transactionData.invoices.length,
      });

      const { data } = await axios.post<ApiResponse<Transaction>>(
        '/api/transactions/store',
        transactionData,
      );

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to store transaction');
      }

      console.log('Transaction stored successfully:', data.data?.id);
      return data.data!;
    } catch (error) {
      console.error('Error storing transaction:', error);
      if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
        throw new Error(error.response.data.error.message);
      }
      throw new Error('Failed to store transaction. Please try again later.');
    }
  },

  // Get transaction by ID
  async getTransactionById(id: string): Promise<Transaction> {
    try {
      const { data } = await axios.get<ApiResponse<Transaction>>(`/api/transactions/${id}`);
      if (!data.success) throw new Error(data.error?.message || 'Failed to fetch transaction');
      return data.data!;
    } catch (error) {
      console.error('Error fetching transaction by ID:', error);
      if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
        throw new Error(error.response.data.error.message);
      }
      throw new Error('Failed to fetch transaction. Please try again later.');
    }
  },

  // Get transactions for an organization
  async getOrganizationTransactions(organizationId: string): Promise<Transaction[]> {
    try {
      const { data } = await axios.get<ApiResponse<Transaction[]>>(
        `/api/transactions/organization/${organizationId}`,
      );
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to fetch organization transactions');
      }
      return data.data || [];
    } catch (error) {
      console.error('Error fetching organization transactions:', error);
      if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
        throw new Error(error.response.data.error.message);
      }
      throw new Error('Failed to fetch transactions. Please try again later.');
    }
  },

  // Get sent transactions for an organization
  async getSentTransactions(organizationId: string): Promise<Transaction[]> {
    try {
      const { data } = await axios.get<ApiResponse<Transaction[]>>(
        `/api/transactions/sent/${organizationId}`,
      );
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to fetch sent transactions');
      }
      return data.data || [];
    } catch (error) {
      console.error('Error fetching sent transactions:', error);
      if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
        throw new Error(error.response.data.error.message);
      }
      throw new Error('Failed to fetch sent transactions. Please try again later.');
    }
  },

  // Get received transactions for an organization
  async getReceivedTransactions(organizationId: string): Promise<Transaction[]> {
    try {
      const { data } = await axios.get<ApiResponse<Transaction[]>>(
        `/api/transactions/received/${organizationId}`,
      );
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to fetch received transactions');
      }
      return data.data || [];
    } catch (error) {
      console.error('Error fetching received transactions:', error);
      if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
        throw new Error(error.response.data.error.message);
      }
      throw new Error('Failed to fetch received transactions. Please try again later.');
    }
  },

  // Update transaction status
  async updateTransactionStatus(id: string, status: string): Promise<Transaction> {
    try {
      const { data } = await axios.put<ApiResponse<Transaction>>(`/api/transactions/${id}/status`, {
        status,
      });
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to update transaction status');
      }
      return data.data!;
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
      const { data } = await axios.put<ApiResponse<Transaction>>(
        `/api/transactions/${id}/complete`,
      );
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to complete transaction');
      }
      return data.data!;
    } catch (error) {
      console.error('Error completing transaction:', error);
      if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
        throw new Error(error.response.data.error.message);
      }
      throw new Error('Failed to complete transaction. Please try again later.');
    }
  },
};
