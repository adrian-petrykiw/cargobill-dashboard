// features/banking/hooks/useBanking.ts
import { useQuery } from '@tanstack/react-query';
import { bankingApi } from '@/services/api/bankingApi';
import type {
  AccountDetail,
  TransfersResponse,
  TransferHistoryParams,
} from '@/schemas/banking.schema';

export function useFBODetails(enabled: boolean = true) {
  const accountQuery = useQuery<AccountDetail>({
    queryKey: ['fboAccountDetails'],
    queryFn: async () => {
      console.log('Fetching FBO account details...');
      const accountDetails = await bankingApi.getAccountInfo();
      console.log('FBO account details fetched:', accountDetails);
      return accountDetails;
    },
    enabled, // Only run query if enabled is true (i.e., FBO account exists)
    retry: 3,
    retryDelay: 1000,
    staleTime: 30000, // 30 seconds
  });

  return {
    accountDetails: accountQuery.data || null,
    isLoading: accountQuery.isLoading,
    error: accountQuery.error,
    refetch: accountQuery.refetch,
  };
}

export function useFBOTransfers(params?: TransferHistoryParams, enabled: boolean = true) {
  const transfersQuery = useQuery<TransfersResponse>({
    queryKey: ['fboTransfers', params],
    queryFn: async () => {
      console.log('Fetching FBO transfers...');
      const transfers = await bankingApi.getTransferHistory(params);
      console.log('FBO transfers fetched:', transfers);
      return transfers;
    },
    enabled, // Only run query if enabled is true (i.e., FBO account exists)
    retry: 3,
    retryDelay: 1000,
    staleTime: 30000, // 30 seconds
  });

  return {
    transfers: transfersQuery.data || null,
    isLoading: transfersQuery.isLoading,
    error: transfersQuery.error,
    refetch: transfersQuery.refetch,
  };
}
