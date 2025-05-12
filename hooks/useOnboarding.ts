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
import { Transaction } from '@solana/web3.js';
import bs58 from 'bs58';

export function useOnboarding() {
  const { wallets, ready } = useSolanaWallets();
  // const { sendTransaction } = useSendTransaction();
  // const { signTransaction } = useSignTransaction();

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

      // Prepare multisig transaction (doesn't create org yet)
      let result;
      try {
        console.log('Creating organization transaction with data:', organizationData);
        console.log('MADE IT TO 0.1');

        result = await organizationApi.createOrganizationTransaction(organizationData);
        console.log('MADE IT TO 0.2');
        console.log('Received transaction data:', {
          multisigPda: result.multisigData.multisigPda,
          createKey: result.multisigData.createKey,
          serializedTxPreview: `${result.multisigData.serializedTransaction.substring(0, 50)}...`,
        });

        console.log('MADE IT TO 0.3');
      } catch (error) {
        console.error('Failed to create organization transaction:', error);
        if (error instanceof Error) {
          throw new Error(error.message);
        }
        throw new Error('Failed to prepare organization transaction. Please try again.');
      }

      // Sign and send the transaction using our centralized solanaService
      let transactionResult;
      try {
        transactionResult = await solanaService.signAndSendTransaction(
          result.multisigData.serializedTransaction,
          embeddedWallet,
          {
            commitment: 'confirmed',
            maxRetries: 5,
            timeout: 60000,
          },
        );
      } catch (error) {
        console.error('Transaction signing failed:', error);
        if (error instanceof Error) {
          if (error.message.includes('User rejected')) {
            throw new Error(
              'Transaction was rejected. Please approve the transaction to continue.',
            );
          }
          throw new Error(error.message);
        }
        throw new Error('Failed to sign transaction. Please try again.');
      }

      const { signature, status } = transactionResult;

      // Verify transaction was confirmed
      if (!status || status.err) {
        console.error('Transaction confirmation failed:', status?.err);
        throw new Error('Transaction failed to confirm on the blockchain. Please try again.');
      }

      // Complete the registration by creating the organization
      try {
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
    // Changed this line to use mutateAsync instead of mutate
    createOrganization: createOrganizationMutation.mutateAsync,
    isCreating: createOrganizationMutation.isPending,
    existingOrganization: checkExistingOrganization.data,
    isCheckingOrganization: checkExistingOrganization.isLoading,
  };
}
