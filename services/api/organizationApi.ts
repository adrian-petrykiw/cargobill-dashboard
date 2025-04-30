// services/api/organizationApi.ts
import axios from 'axios';
import type { Organization, CreateOrganizationRequest } from '@/schemas/organization.schema';
import type { ApiResponse } from '@/types/api/responses';

export const organizationApi = {
  async getOrganizations(): Promise<Organization[]> {
    const { data } = await axios.get<ApiResponse<Organization[]>>('/api/organizations');
    if (!data.success) throw new Error(data.error?.message || 'Failed to fetch organizations');
    return data.data || [];
  },

  async createOrganization(organization: CreateOrganizationRequest): Promise<Organization> {
    const { data } = await axios.post<ApiResponse<Organization>>(
      '/api/organizations',
      organization,
    );
    if (!data.success) throw new Error(data.error?.message || 'Failed to create organization');
    return data.data!;
  },

  // TODO Other methods...
};
