// hooks/useTransactions.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionApi, type StoreTransactionData } from '@/services/api/transactionApi';
import { toast } from 'react-hot-toast';
import type { Transaction } from '@/schemas/transaction.schema';

export function useTransactions(organizationId?: string) {
  const queryClient = useQueryClient();

  // Query for organization transactions
  const organizationTransactionsQuery = useQuery<Transaction[]>({
    queryKey: ['transactions', 'organization', organizationId],
    queryFn: async () => {
      if (!organizationId) throw new Error('Organization ID is required');
      return await transactionApi.getOrganizationTransactions(organizationId);
    },
    enabled: !!organizationId,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('401')) {
        return false; // Don't retry auth errors
      }
      return failureCount < 3;
    },
  });

  // Query for sent transactions
  const sentTransactionsQuery = useQuery<Transaction[]>({
    queryKey: ['transactions', 'sent', organizationId],
    queryFn: async () => {
      if (!organizationId) throw new Error('Organization ID is required');
      return await transactionApi.getSentTransactions(organizationId);
    },
    enabled: !!organizationId,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('401')) {
        return false;
      }
      return failureCount < 3;
    },
  });

  // Query for received transactions
  const receivedTransactionsQuery = useQuery<Transaction[]>({
    queryKey: ['transactions', 'received', organizationId],
    queryFn: async () => {
      if (!organizationId) throw new Error('Organization ID is required');
      return await transactionApi.getReceivedTransactions(organizationId);
    },
    enabled: !!organizationId,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('401')) {
        return false;
      }
      return failureCount < 3;
    },
  });

  // Mutation for storing a transaction
  const storeTransactionMutation = useMutation({
    mutationFn: async (transactionData: StoreTransactionData) => {
      return await transactionApi.storeTransaction(transactionData);
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch relevant queries
      queryClient.invalidateQueries({
        queryKey: ['transactions', 'organization', variables.organization_id],
      });
      queryClient.invalidateQueries({
        queryKey: ['transactions', 'sent', variables.organization_id],
      });

      // If we know the recipient organization, invalidate their queries too
      if (variables.recipient_organization_id) {
        queryClient.invalidateQueries({
          queryKey: ['transactions', 'organization', variables.recipient_organization_id],
        });
        queryClient.invalidateQueries({
          queryKey: ['transactions', 'received', variables.recipient_organization_id],
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

  // Mutation for updating transaction status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await transactionApi.updateTransactionStatus(id, status);
    },
    onSuccess: (data) => {
      // Update the specific transaction in all relevant queries
      queryClient.setQueryData<Transaction[]>(
        ['transactions', 'organization', data.sender_organization_id],
        (old) => old?.map((tx) => (tx.id === data.id ? data : tx)),
      );
      queryClient.setQueryData<Transaction[]>(
        ['transactions', 'sent', data.sender_organization_id],
        (old) => old?.map((tx) => (tx.id === data.id ? data : tx)),
      );
      if (data.recipient_organization_id) {
        queryClient.setQueryData<Transaction[]>(
          ['transactions', 'received', data.recipient_organization_id],
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
      // Update the specific transaction in all relevant queries
      queryClient.setQueryData<Transaction[]>(
        ['transactions', 'organization', data.sender_organization_id],
        (old) => old?.map((tx) => (tx.id === data.id ? data : tx)),
      );
      queryClient.setQueryData<Transaction[]>(
        ['transactions', 'sent', data.sender_organization_id],
        (old) => old?.map((tx) => (tx.id === data.id ? data : tx)),
      );
      if (data.recipient_organization_id) {
        queryClient.setQueryData<Transaction[]>(
          ['transactions', 'received', data.recipient_organization_id],
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
    // Check all cached transaction lists for the transaction
    const orgTransactions = queryClient.getQueryData<Transaction[]>([
      'transactions',
      'organization',
      organizationId,
    ]);
    const sentTransactions = queryClient.getQueryData<Transaction[]>([
      'transactions',
      'sent',
      organizationId,
    ]);
    const receivedTransactions = queryClient.getQueryData<Transaction[]>([
      'transactions',
      'received',
      organizationId,
    ]);

    return [
      ...(orgTransactions || []),
      ...(sentTransactions || []),
      ...(receivedTransactions || []),
    ].find((tx) => tx.id === transactionId);
  };

  // Utility function to get total transaction amounts
  const getTransactionSummary = () => {
    const sent = sentTransactionsQuery.data || [];
    const received = receivedTransactionsQuery.data || [];

    return {
      totalSent: sent.reduce((sum, tx) => sum + tx.amount, 0),
      totalReceived: received.reduce((sum, tx) => sum + tx.amount, 0),
      sentCount: sent.length,
      receivedCount: received.length,
      pendingCount: [...sent, ...received].filter((tx) => tx.status === 'pending').length,
      completedCount: [...sent, ...received].filter((tx) => tx.status === 'completed').length,
    };
  };

  return {
    // Query data
    organizationTransactions: organizationTransactionsQuery.data || [],
    sentTransactions: sentTransactionsQuery.data || [],
    receivedTransactions: receivedTransactionsQuery.data || [],

    // Loading states
    isLoadingOrganizationTransactions: organizationTransactionsQuery.isLoading,
    isLoadingSentTransactions: sentTransactionsQuery.isLoading,
    isLoadingReceivedTransactions: receivedTransactionsQuery.isLoading,
    isLoading:
      organizationTransactionsQuery.isLoading ||
      sentTransactionsQuery.isLoading ||
      receivedTransactionsQuery.isLoading,

    // Error states
    organizationTransactionsError: organizationTransactionsQuery.error,
    sentTransactionsError: sentTransactionsQuery.error,
    receivedTransactionsError: receivedTransactionsQuery.error,

    // Mutations
    storeTransaction: storeTransactionMutation.mutate,
    isStoringTransaction: storeTransactionMutation.isPending,
    storeTransactionError: storeTransactionMutation.error,

    updateTransactionStatus: updateStatusMutation.mutate,
    isUpdatingStatus: updateStatusMutation.isPending,

    completeTransaction: completeTransactionMutation.mutate,
    isCompletingTransaction: completeTransactionMutation.isPending,

    // Utility functions
    getTransactionFromCache,
    getTransactionSummary,

    // Refetch functions
    refetchOrganizationTransactions: organizationTransactionsQuery.refetch,
    refetchSentTransactions: sentTransactionsQuery.refetch,
    refetchReceivedTransactions: receivedTransactionsQuery.refetch,
    refetchAll: () => {
      organizationTransactionsQuery.refetch();
      sentTransactionsQuery.refetch();
      receivedTransactionsQuery.refetch();
    },
  };
}

// Hook for getting a specific transaction by ID
export function useTransaction(transactionId: string) {
  const transactionQuery = useQuery<Transaction>({
    queryKey: ['transaction', transactionId],
    queryFn: async () => {
      return await transactionApi.getTransactionById(transactionId);
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
