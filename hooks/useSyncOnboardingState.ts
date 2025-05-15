// hooks/useSyncOnboardingState.ts
import { useEffect } from 'react';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useOrganizations } from '@/hooks/useOrganizations';

export function useSyncOnboardingState() {
  const { organizations, organization, isLoading } = useOrganizations();
  const setBusinessVerified = useOnboardingStore((state) => state.setBusinessVerified);

  // Sync verification status whenever organization data changes
  useEffect(() => {
    if (!isLoading) {
      // Get the organization from either the single organization or the first in the array
      const primaryOrg =
        organization || (organizations && organizations.length > 0 ? organizations[0] : null);

      if (primaryOrg) {
        // Determine verification status
        const isVerified =
          primaryOrg.last_verified_at !== null && primaryOrg.verification_status === 'verified';

        console.log('Syncing onboarding store verification status:', {
          verificationStatus: primaryOrg.verification_status,
          lastVerifiedAt: primaryOrg.last_verified_at,
          isVerified,
        });

        // Update the onboarding store
        setBusinessVerified(isVerified);
      }
    }
  }, [organizations, organization, isLoading, setBusinessVerified]);

  return null;
}
