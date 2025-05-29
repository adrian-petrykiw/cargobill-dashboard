// features/transactions/hooks/useTransactions.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionApi } from '@/services/api/transactionApi';
import { toast } from 'react-hot-toast';
import type {
  Transaction,
  StoreTransactionData,
  UpdateTransactionData,
} from '@/schemas/transaction.schema';

export function useTransactions(organizationId?: string) {
  const queryClient = useQueryClient();

  // SINGLE QUERY - Fetch all organization transactions
  const organizationTransactionsQuery = useQuery<Transaction[]>({
    queryKey: ['transactions', 'organization', organizationId],
    queryFn: async () => {
      if (!organizationId) throw new Error('Organization ID is required');

      console.log('Fetching organization transactions for:', organizationId);

      try {
        const result = await transactionApi.getOrganizationTransactions(organizationId);

        console.log('API returned:', {
          result,
          isArray: Array.isArray(result),
          length: Array.isArray(result) ? result.length : 'N/A',
          type: typeof result,
        });

        // DEFENSIVE: Ensure we always return an array
        if (!Array.isArray(result)) {
          console.error('API returned non-array result:', result);
          return [];
        }

        return result;
      } catch (error) {
        console.error('Error in organizationTransactionsQuery:', error);
        throw error; // Re-throw to trigger React Query error handling
      }
    },
    enabled: !!organizationId,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('401')) {
        return false; // Don't retry auth errors
      }
      return failureCount < 3;
    },
  });

  // COMPUTED VALUES - Filter the single data source for sent/received views
  const allTransactions = Array.isArray(organizationTransactionsQuery.data)
    ? organizationTransactionsQuery.data
    : [];

  const sentTransactions = allTransactions.filter(
    (tx: Transaction) => tx.sender_organization_id === organizationId,
  );

  const receivedTransactions = allTransactions.filter(
    (tx: Transaction) => tx.recipient_organization_id === organizationId,
  );

  console.log('Computed transaction splits:', {
    total: allTransactions.length,
    sent: sentTransactions.length,
    received: receivedTransactions.length,
    organizationId,
  });

  // Mutation for storing a transaction
  const storeTransactionMutation = useMutation({
    mutationFn: async (transactionData: StoreTransactionData) => {
      return await transactionApi.storeTransaction(transactionData);
    },
    onSuccess: (data, variables) => {
      // Only need to invalidate the single query
      queryClient.invalidateQueries({
        queryKey: ['transactions', 'organization', variables.organization_id],
      });

      // If we know the recipient organization, invalidate their queries too
      if (variables.recipient_organization_id) {
        queryClient.invalidateQueries({
          queryKey: ['transactions', 'organization', variables.recipient_organization_id],
        });
      }

      toast.success('Transaction stored successfully');
      console.log('Transaction stored successfully:', data.id);
    },
    onError: (error) => {
      console.error('Transaction storage error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to store transaction');
    },
  });

  // Mutation for updating a transaction
  const updateTransactionMutation = useMutation({
    mutationFn: async ({ id, updateData }: { id: string; updateData: UpdateTransactionData }) => {
      return await transactionApi.updateTransaction(id, updateData);
    },
    onSuccess: (data) => {
      // Update the organization query cache
      queryClient.setQueryData<Transaction[]>(
        ['transactions', 'organization', data.sender_organization_id],
        (old) => old?.map((tx) => (tx.id === data.id ? data : tx)),
      );

      // If recipient org is different, update their cache too
      if (
        data.recipient_organization_id &&
        data.recipient_organization_id !== data.sender_organization_id
      ) {
        queryClient.setQueryData<Transaction[]>(
          ['transactions', 'organization', data.recipient_organization_id],
          (old) => old?.map((tx) => (tx.id === data.id ? data : tx)),
        );
      }

      // Also invalidate to ensure fresh data
      queryClient.invalidateQueries({
        queryKey: ['transactions', 'organization', data.sender_organization_id],
      });
      if (
        data.recipient_organization_id &&
        data.recipient_organization_id !== data.sender_organization_id
      ) {
        queryClient.invalidateQueries({
          queryKey: ['transactions', 'organization', data.recipient_organization_id],
        });
      }

      toast.success('Transaction updated successfully');
    },
    onError: (error) => {
      console.error('Transaction update error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update transaction');
    },
  });

  // Mutation for updating transaction status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await transactionApi.updateTransactionStatus(id, status);
    },
    onSuccess: (data) => {
      // Update the organization query cache
      queryClient.setQueryData<Transaction[]>(
        ['transactions', 'organization', data.sender_organization_id],
        (old) => old?.map((tx) => (tx.id === data.id ? data : tx)),
      );

      // If recipient org is different, update their cache too
      if (
        data.recipient_organization_id &&
        data.recipient_organization_id !== data.sender_organization_id
      ) {
        queryClient.setQueryData<Transaction[]>(
          ['transactions', 'organization', data.recipient_organization_id],
          (old) => old?.map((tx) => (tx.id === data.id ? data : tx)),
        );
      }

      toast.success('Transaction status updated');
    },
    onError: (error) => {
      console.error('Transaction status update error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update transaction status');
    },
  });

  // Mutation for completing a transaction
  const completeTransactionMutation = useMutation({
    mutationFn: async (id: string) => {
      return await transactionApi.completeTransaction(id);
    },
    onSuccess: (data) => {
      // Update the organization query cache
      queryClient.setQueryData<Transaction[]>(
        ['transactions', 'organization', data.sender_organization_id],
        (old) => old?.map((tx) => (tx.id === data.id ? data : tx)),
      );

      // If recipient org is different, update their cache too
      if (
        data.recipient_organization_id &&
        data.recipient_organization_id !== data.sender_organization_id
      ) {
        queryClient.setQueryData<Transaction[]>(
          ['transactions', 'organization', data.recipient_organization_id],
          (old) => old?.map((tx) => (tx.id === data.id ? data : tx)),
        );
      }

      toast.success('Transaction completed successfully');
    },
    onError: (error) => {
      console.error('Transaction completion error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to complete transaction');
    },
  });

  // Utility function to get transaction by ID from cache
  const getTransactionFromCache = (transactionId: string): Transaction | undefined => {
    return allTransactions.find((tx) => tx.id === transactionId);
  };

  // Utility function to get total transaction amounts
  const getTransactionSummary = () => {
    return {
      totalSent: sentTransactions.reduce((sum, tx) => sum + tx.amount, 0),
      totalReceived: receivedTransactions.reduce((sum, tx) => sum + tx.amount, 0),
      sentCount: sentTransactions.length,
      receivedCount: receivedTransactions.length,
      pendingCount: allTransactions.filter((tx) => tx.status === 'pending').length,
      completedCount: allTransactions.filter((tx) => tx.status === 'completed').length,
    };
  };

  console.log('useTransactions returning:', {
    organizationTransactions: allTransactions,
    sentTransactions: sentTransactions,
    receivedTransactions: receivedTransactions,
    isArray: Array.isArray(allTransactions),
    length: allTransactions.length,
    isLoading: organizationTransactionsQuery.isLoading,
    hasError: !!organizationTransactionsQuery.error,
  });

  return {
    // Query data - All computed from single source
    organizationTransactions: allTransactions,
    sentTransactions: sentTransactions,
    receivedTransactions: receivedTransactions,

    // Loading states - Only one query now
    isLoadingOrganizationTransactions: organizationTransactionsQuery.isLoading,
    isLoadingSentTransactions: organizationTransactionsQuery.isLoading, // Same as organization
    isLoadingReceivedTransactions: organizationTransactionsQuery.isLoading, // Same as organization
    isLoading: organizationTransactionsQuery.isLoading,

    // Error states - Only one query now
    organizationTransactionsError: organizationTransactionsQuery.error,
    sentTransactionsError: organizationTransactionsQuery.error, // Same as organization
    receivedTransactionsError: organizationTransactionsQuery.error, // Same as organization

    // Mutations
    storeTransaction: storeTransactionMutation.mutate,
    isStoringTransaction: storeTransactionMutation.isPending,
    storeTransactionError: storeTransactionMutation.error,

    updateTransaction: updateTransactionMutation.mutate,
    isUpdatingTransaction: updateTransactionMutation.isPending,
    updateTransactionError: updateTransactionMutation.error,

    updateTransactionStatus: updateStatusMutation.mutate,
    isUpdatingStatus: updateStatusMutation.isPending,

    completeTransaction: completeTransactionMutation.mutate,
    isCompletingTransaction: completeTransactionMutation.isPending,

    // Utility functions
    getTransactionFromCache,
    getTransactionSummary,

    // Refetch functions - Only one query to refetch
    refetchOrganizationTransactions: organizationTransactionsQuery.refetch,
    refetchSentTransactions: organizationTransactionsQuery.refetch, // Same as organization
    refetchReceivedTransactions: organizationTransactionsQuery.refetch, // Same as organization
    refetchAll: () => {
      organizationTransactionsQuery.refetch();
    },
  };
}

// Hook for getting a specific transaction by ID
export function useTransaction(transactionId: string) {
  const transactionQuery = useQuery<Transaction>({
    queryKey: ['transaction', transactionId],
    queryFn: async () => {
      const result = await transactionApi.getTransactionById(transactionId);

      // DEFENSIVE: Validate the result
      if (!result || typeof result !== 'object') {
        throw new Error('Invalid transaction data received');
      }

      return result;
    },
    enabled: !!transactionId,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('401')) {
        return false;
      }
      return failureCount < 3;
    },
  });

  return {
    transaction: transactionQuery.data,
    isLoading: transactionQuery.isLoading,
    error: transactionQuery.error,
    refetch: transactionQuery.refetch,
  };
}
