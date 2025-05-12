// hooks/useOrganizations.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationApi } from '@/services/api/organizationApi';
import type { Organization, UpdateOrganizationRequest } from '@/schemas/organization.schema';
import toast from 'react-hot-toast';

export function useOrganizations() {
  const queryClient = useQueryClient();

  // Query to get organizations
  const organizationsQuery = useQuery<Organization[]>({
    queryKey: ['userOrganizations'],
    queryFn: async () => {
      try {
        return await organizationApi.getOrganizations();
      } catch (error) {
        // Special handling for new users - return empty array instead of throwing
        if (error instanceof Error && error.message.includes('User not registered in system')) {
          console.warn('User may be new, returning empty organizations list');
          return [];
        }
        throw error;
      }
    },
    retry: 3,
    retryDelay: 1000,
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
      return await organizationApi.updateOrganization(id, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userOrganizations'] });
      toast.success('Organization updated successfully!');
    },
    onError: (error: Error) => {
      console.error('Failed to update organization:', error);
      toast.error(error.message || 'Failed to update organization');
    },
  });

  return {
    organizations: organizationsQuery.data || ([] as Organization[]),
    isLoading: organizationsQuery.isLoading,
    error: organizationsQuery.error,
    updateOrganization: updateOrganizationMutation.mutate,
    isUpdating: updateOrganizationMutation.isPending,
  };
}
