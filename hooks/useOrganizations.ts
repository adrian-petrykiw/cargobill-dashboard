// hooks/useOrganizations.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationApi } from '@/services/api/organizationApi';
import type { Organization, UpdateOrganizationRequest } from '@/schemas/organization.schema';
import { toast } from 'sonner';
import { useOnboardingStore } from '@/stores/onboardingStore';

export function useOrganizations() {
  const queryClient = useQueryClient();
  const setBusinessVerified = useOnboardingStore((state) => state.setBusinessVerified);

  // Query to get organizations
  const organizationsQuery = useQuery<Organization[]>({
    queryKey: ['userOrganizations'],
    queryFn: async () => {
      try {
        console.log('Fetching organizations...');
        const organizations = await organizationApi.getOrganizations();
        console.log('Organizations fetched:', organizations);

        // Sync verification status with onboarding store if we have an organization
        if (organizations && organizations.length > 0) {
          const primaryOrg = organizations[0];
          const isVerified =
            primaryOrg.last_verified_at !== null && primaryOrg.verification_status === 'verified';

          console.log('Organization verification status:', {
            verificationStatus: primaryOrg.verification_status,
            lastVerifiedAt: primaryOrg.last_verified_at,
            isVerified,
          });

          // Update onboarding store
          // setBusinessVerified(isVerified);
        }

        return organizations;
      } catch (error) {
        // Special handling for new users - return empty array instead of throwing
        if (error instanceof Error && error.message.includes('User not registered in system')) {
          console.warn('User may be new, returning empty organizations list');
          return [];
        }
        console.error('Error fetching organizations:', error);
        throw error;
      }
    },
    retry: 3,
    retryDelay: 1000,
    staleTime: 30000, // 30 seconds
  });

  // Mutation to update organization
  const updateOrganizationMutation = useMutation({
    mutationFn: async ({
      id,
      updateData,
    }: {
      id: string;
      updateData: UpdateOrganizationRequest;
    }) => {
      console.log('Updating organization:', id, updateData);
      return await organizationApi.updateOrganization(id, updateData);
    },
    onSuccess: (data) => {
      console.log('Organization updated successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['userOrganizations'] });
      toast.success('Organization updated successfully!');
    },
    onError: (error: Error) => {
      console.error('Failed to update organization:', error);
      toast.error(error.message || 'Failed to update organization');
    },
  });

  // Get the primary organization (first in the list)
  const organization = organizationsQuery.data?.[0] || null;

  // Check if the organization is verified based on last_verified_at field
  const isOrganizationVerified =
    organization &&
    organization.last_verified_at !== null &&
    organization.verification_status === 'verified';

  return {
    organizations: organizationsQuery.data || ([] as Organization[]),
    organization,
    isLoading: organizationsQuery.isLoading,
    error: organizationsQuery.error,
    updateOrganization: updateOrganizationMutation.mutate,
    isUpdating: updateOrganizationMutation.isPending,
    refetch: organizationsQuery.refetch,
    isOrganizationVerified,
  };
}
