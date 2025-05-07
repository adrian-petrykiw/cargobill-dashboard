// services/api/organizationApi.ts
import axios from 'axios';
import type { Organization, CreateOrganizationRequest } from '@/schemas/organization.schema';
import type { OnboardingOrganizationRequest } from '@/schemas/organization.schema';
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

  async createOrganizationTransaction(organization: OnboardingOrganizationRequest): Promise<{
    organizationData: OnboardingOrganizationRequest;
    multisigData: {
      serializedTransaction: string;
      multisigPda: string;
      createKey: string;
      blockhash: string;
      lastValidBlockHeight: number;
    };
  }> {
    const { data } = await axios.post<ApiResponse<any>>(
      '/api/organizations/create-with-multisig',
      organization,
    );
    if (!data.success)
      throw new Error(data.error?.message || 'Failed to prepare multisig transaction');
    return data.data!;
  },

  async completeOrganizationRegistration(
    organizationData: OnboardingOrganizationRequest,
    signature: string,
    multisigPda: string,
    createKey: string,
  ): Promise<Organization> {
    const { data } = await axios.post<ApiResponse<Organization>>(
      '/api/organizations/complete-multisig-registration',
      { organizationData, signature, multisigPda, createKey },
    );
    if (!data.success)
      throw new Error(data.error?.message || 'Failed to complete multisig registration');
    return data.data!;
  },
};
