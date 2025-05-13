// stores/organizationStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import { Organization } from '@/schemas/organization.schema';

interface OrganizationState {
  organizations: Organization[];
  primaryOrganization: Organization | null;
  isLoading: boolean;
  error: Error | null;

  // Actions
  setOrganizations: (organizations: Organization[]) => void;
  fetchOrganizations: () => Promise<void>;
  updateOrganization: (id: string, orgData: Partial<Organization>) => Promise<void>;
  clearOrganizations: () => void;
}

export const useOrganizationStore = create<OrganizationState>()(
  persist(
    (set, get) => ({
      organizations: [],
      primaryOrganization: null,
      isLoading: false,
      error: null,

      setOrganizations: (organizations) => {
        const primaryOrg = organizations && organizations.length > 0 ? organizations[0] : null;
        set({ organizations, primaryOrganization: primaryOrg });
        console.log('Organization store updated:', { organizations, primaryOrg });
      },

      fetchOrganizations: async () => {
        try {
          console.log('Fetching organizations from store...');
          set({ isLoading: true, error: null });
          const { data } = await axios.get('/api/organizations');
          if (data.success) {
            const orgs = data.data;
            const primaryOrg = orgs && orgs.length > 0 ? orgs[0] : null;
            console.log('Organizations fetched in store:', orgs);
            set({ organizations: orgs, primaryOrganization: primaryOrg, isLoading: false });
          } else {
            throw new Error('Failed to fetch organizations');
          }
        } catch (error) {
          console.error('Error fetching organizations in store:', error);
          set({ error: error as Error, isLoading: false });
        }
      },

      updateOrganization: async (id, orgData) => {
        try {
          console.log('Updating organization in store:', id, orgData);
          set({ isLoading: true, error: null });
          const { data } = await axios.put(`/api/organizations/${id}`, orgData);
          if (data.success) {
            // Refetch to ensure we have the latest data
            get().fetchOrganizations();
          } else {
            throw new Error('Failed to update organization');
          }
        } catch (error) {
          console.error('Error updating organization in store:', error);
          set({ error: error as Error, isLoading: false });
          throw error;
        }
      },

      clearOrganizations: () => {
        set({ organizations: [], primaryOrganization: null, error: null });
      },
    }),
    {
      name: 'organization-storage',
      // Only persist non-sensitive data
      partialize: (state) => ({
        organizations: state.organizations.map((org) => ({
          id: org.id,
          name: org.name,
          country: org.country,
        })),
      }),
    },
  ),
);
