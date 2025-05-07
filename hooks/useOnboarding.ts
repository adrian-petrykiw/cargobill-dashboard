// hooks/useOnboarding.ts
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSolanaWallets } from '@privy-io/react-auth/solana';
import { organizationApi } from '@/services/api/organizationApi';
import { solanaService } from '@/services/blockchain/solana';
import { useUserStore } from '@/stores/userStore';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { OnboardingOrganizationRequest } from '@/schemas/organization.schema';
import toast from 'react-hot-toast';

export function useOnboarding() {
  const { wallets, ready } = useSolanaWallets();
  const user = useUserStore((state) => state.user);
  const setBusinessVerified = useOnboardingStore((state) => state.setBusinessVerified);

  const createOrganizationMutation = useMutation({
    mutationFn: async (organizationData: OnboardingOrganizationRequest) => {
      // Ensure wallets are ready and we have an embedded wallet
      if (!ready) {
        throw new Error('Wallet not ready');
      }

      const embeddedWallet = wallets.find((wallet) => wallet.walletClientType === 'privy');
      if (!embeddedWallet) {
        throw new Error('No embedded wallet found');
      }

      try {
        // Prepare multisig transaction (doesn't create org yet)
        const result = await organizationApi.createOrganizationTransaction(organizationData);

        // Sign and send the transaction with retry logic and priority fees
        const { signature, signedTransaction, status } = await solanaService.signAndSendTransaction(
          result.multisigData.serializedTransaction,
          embeddedWallet,
          {
            commitment: 'confirmed',
            maxRetries: 5,
            timeout: 60000,
          },
        );

        // Verify transaction was confirmed
        if (!status || status.err) {
          throw new Error('Transaction failed to confirm');
        }

        // Complete the registration by creating the organization
        const completedOrganization = await organizationApi.completeOrganizationRegistration(
          result.organizationData,
          signature,
          result.multisigData.multisigPda,
          result.multisigData.createKey,
        );

        // Update onboarding store
        setBusinessVerified(true);

        return completedOrganization;
      } catch (error) {
        // Handle specific error cases
        if (error instanceof Error) {
          if (error.message.includes('WALLET_MISMATCH')) {
            throw new Error(
              'Your wallet address has changed. Please update your profile and try again.',
            );
          }
          if (error.message.includes('Transaction failed')) {
            throw new Error('Transaction failed to confirm. Please try again.');
          }
        }
        throw error;
      }
    },
    onSuccess: (organization) => {
      toast.success('Organization created successfully!');
    },
    onError: (error: Error) => {
      console.error('Failed to create organization:', error);
      toast.error(error.message || 'Failed to create organization. Please try again.');
    },
  });

  const checkExistingOrganization = useQuery({
    queryKey: ['userOrganization', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const organizations = await organizationApi.getOrganizations();
      return organizations.length > 0 ? organizations[0] : null;
    },
    enabled: !!user?.id,
  });

  return {
    createOrganization: createOrganizationMutation.mutate,
    isCreating: createOrganizationMutation.isPending,
    existingOrganization: checkExistingOrganization.data,
    isCheckingOrganization: checkExistingOrganization.isLoading,
  };
}
