// hooks/useSyncOnboardingState.ts
import { useEffect, useCallback } from 'react';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useOrganizations } from '@/hooks/useOrganizations';
import axios from 'axios';

export function useSyncOnboardingState() {
  const { organizations, organization, isLoading } = useOrganizations();
  const setBusinessVerified = useOnboardingStore((state) => state.setBusinessVerified);
  const setPaymentMethodsLinked = useOnboardingStore((state) => state.setPaymentMethodsLinked);

  const fetchAndSyncPaymentMethods = useCallback(
    async (organizationId: string) => {
      try {
        const response = await axios.get(`/api/organizations/${organizationId}/payment-methods`);

        if (response.data.success) {
          const { bankAccounts, cards } = response.data.data;
          const hasPaymentMethods =
            (bankAccounts && bankAccounts.length > 0) || (cards && cards.length > 0);

          console.log('Syncing payment methods status:', {
            bankAccountsCount: bankAccounts?.length || 0,
            cardsCount: cards?.length || 0,
            hasPaymentMethods,
          });

          setPaymentMethodsLinked(hasPaymentMethods);
        }
      } catch (error) {
        console.warn('Error fetching payment methods for onboarding sync:', error);
        // Don't throw error, just log it - we don't want to break the onboarding flow
        // The user can still manually check by visiting the linked accounts tab
      }
    },
    [setPaymentMethodsLinked],
  );

  // Sync verification status and payment methods whenever organization data changes
  useEffect(() => {
    if (!isLoading) {
      // Get the organization from either the single organization or the first in the array
      const primaryOrg =
        organization || (organizations && organizations.length > 0 ? organizations[0] : null);

      if (primaryOrg) {
        const isVerified =
          primaryOrg.last_verified_at !== null && primaryOrg.verification_status === 'verified';

        console.log('Syncing onboarding store verification status:', {
          verificationStatus: primaryOrg.verification_status,
          lastVerifiedAt: primaryOrg.last_verified_at,
          isVerified,
        });

        setBusinessVerified(isVerified);

        if (isVerified) {
          fetchAndSyncPaymentMethods(primaryOrg.id);
        } else {
          setPaymentMethodsLinked(false);
        }
      }
    }
  }, [
    organizations,
    organization,
    isLoading,
    setBusinessVerified,
    setPaymentMethodsLinked,
    fetchAndSyncPaymentMethods,
  ]);

  return null;
}
