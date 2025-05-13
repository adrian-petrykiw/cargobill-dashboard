// hooks/useOnboarding.ts
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  useSendTransaction,
  useSignTransaction,
  useSolanaWallets,
} from '@privy-io/react-auth/solana';
import { organizationApi } from '@/services/api/organizationApi';
import { solanaService } from '@/services/blockchain/solana';
import { useUserStore } from '@/stores/userStore';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { OnboardingOrganizationRequest } from '@/schemas/organization.schema';
import toast from 'react-hot-toast';
import { Transaction, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

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

      console.log('User wallet address:', embeddedWallet.address);

      // Create multisig transaction (doesn't create org yet)
      let result;
      try {
        console.log('Creating organization with data:', organizationData);

        result = await organizationApi.createOrganizationTransaction(organizationData);
        console.log(
          'Transaction successfully submitted with signature:',
          result.multisigData.signature,
        );

        // Verify transaction confirmation
        const status = await solanaService.confirmTransactionWithRetry(
          result.multisigData.signature,
          'confirmed',
          5,
          60000,
        );

        if (!status || status.err) {
          console.error('Transaction confirmation failed:', status?.err);
          throw new Error('Transaction failed to confirm on the blockchain. Please try again.');
        }

        console.log('Transaction confirmed on client side');
      } catch (error) {
        console.error('Failed to create or confirm organization transaction:', error);
        if (error instanceof Error) {
          throw new Error(error.message);
        }
        throw new Error('Failed to prepare or confirm organization transaction. Please try again.');
      }

      // Complete the registration by creating the organization
      try {
        const completedOrganization = await organizationApi.completeOrganizationRegistration(
          result.organizationData,
          result.multisigData.signature,
          result.multisigData.multisigPda,
          result.multisigData.createKey,
        );

        // Update onboarding store
        setBusinessVerified(true);

        return completedOrganization;
      } catch (error) {
        console.error('Failed to complete organization registration:', error);
        if (error instanceof Error) {
          if (error.message.includes('WALLET_MISMATCH')) {
            throw new Error(
              'Your wallet address has changed. Please update your profile and try again.',
            );
          }
          throw new Error(error.message);
        }
        throw new Error('Failed to complete organization registration. Please try again.');
      }
    },
    onSuccess: (organization) => {
      toast.success('Organization created successfully!');
    },
    onError: (error: Error) => {
      console.error('Failed to create organization:', error);

      // Categorize errors for better user feedback
      if (error.message.includes('wallet') || error.message.includes('Wallet')) {
        toast.error(
          error.message || 'Wallet connection issue. Please check your wallet and try again.',
        );
      } else if (error.message.includes('Transaction')) {
        toast.error(error.message || 'Transaction failed. Please try again.');
      } else if (error.message.includes('blockchain')) {
        toast.error(error.message || 'Blockchain confirmation failed. Please try again later.');
      } else if (error.message.includes('Reached end of buffer')) {
        toast.error(
          'Failed to process the transaction. This is a known issue with some complex Squads transactions. Please try again.',
        );
      } else {
        toast.error(error.message || 'Failed to create organization. Please try again.');
      }
    },
  });

  const checkExistingOrganization = useQuery({
    queryKey: ['userOrganization', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      try {
        const organizations = await organizationApi.getOrganizations();
        return organizations.length > 0 ? organizations[0] : null;
      } catch (error) {
        console.error('Failed to check existing organizations:', error);
        toast.error('Failed to check your organizations. Please refresh the page.');
        return null;
      }
    },
    enabled: !!user?.id,
  });

  return {
    createOrganization: createOrganizationMutation.mutateAsync,
    isCreating: createOrganizationMutation.isPending,
    existingOrganization: checkExistingOrganization.data,
    isCheckingOrganization: checkExistingOrganization.isLoading,
  };
}
