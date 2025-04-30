// hooks/useOrganizations.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type { Organization, CreateOrganizationRequest } from '@/schemas/organization.schema';

export function useOrganizations() {
  const queryClient = useQueryClient();

  const organizationsQuery = useQuery<Organization[]>({
    queryKey: ['organizations'],
    queryFn: async () => {
      const { data } = await axios.get('/api/organizations');
      return data.data;
    },
  });

  const createOrganization = useMutation({
    mutationFn: async (newOrg: CreateOrganizationRequest) => {
      const { data } = await axios.post('/api/organizations', newOrg);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });

  return {
    organizations: organizationsQuery.data || [],
    isLoading: organizationsQuery.isLoading,
    error: organizationsQuery.error,
    createOrganization: createOrganization.mutate,
    isCreating: createOrganization.isPending,
  };
}
