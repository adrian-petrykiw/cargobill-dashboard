// services/api/organizationApi.ts
import axios from 'axios';
import type {
  Organization,
  CreateOrganizationRequest,
  UpdateOrganizationRequest,
} from '@/schemas/organization.schema';
import type { OnboardingOrganizationRequest } from '@/schemas/organization.schema';
import type { ApiResponse } from '@/types/api/responses';

export const organizationApi = {
  async getOrganizations(): Promise<Organization[]> {
    try {
      const { data } = await axios.get<ApiResponse<Organization[]>>('/api/organizations');
      if (!data.success) throw new Error(data.error?.message || 'Failed to fetch organizations');
      return data.data || [];
    } catch (error) {
      console.error('Error fetching organizations:', error);

      // Special handling for new users
      if (
        axios.isAxiosError(error) &&
        error.response?.status === 401 &&
        error.response?.data?.error?.message?.includes('User not registered')
      ) {
        console.warn('User registration may not have propagated yet, returning empty list');
        return [];
      }

      if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
        throw new Error(error.response.data.error.message);
      }
      throw new Error('Failed to fetch organizations. Please try again later.');
    }
  },

  async updateOrganization(
    id: string,
    updateData: UpdateOrganizationRequest,
  ): Promise<Organization> {
    try {
      const { data } = await axios.put<ApiResponse<Organization>>(
        `/api/organizations/${id}`,
        updateData,
      );
      if (!data.success) throw new Error(data.error?.message || 'Failed to update organization');
      return data.data!;
    } catch (error) {
      console.error('Error updating organization:', error);
      if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
        throw new Error(error.response.data.error.message);
      }
      throw new Error('Failed to update organization. Please try again later.');
    }
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
    try {
      const { data } = await axios.post<ApiResponse<any>>(
        '/api/organizations/create-with-multisig',
        organization,
      );
      if (!data.success)
        throw new Error(data.error?.message || 'Failed to prepare multisig transaction');
      return data.data!;
    } catch (error) {
      console.error('Error creating organization transaction:', error);
      if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
        throw new Error(error.response.data.error.message);
      }
      throw new Error('Failed to prepare multisig transaction. Please try again later.');
    }
  },

  async completeOrganizationRegistration(
    organizationData: OnboardingOrganizationRequest,
    signature: string,
    multisigPda: string,
    createKey: string,
  ): Promise<Organization> {
    try {
      const { data } = await axios.post<ApiResponse<Organization>>(
        '/api/organizations/complete-multisig-registration',
        { organizationData, signature, multisigPda, createKey },
      );
      if (!data.success)
        throw new Error(data.error?.message || 'Failed to complete multisig registration');
      return data.data!;
    } catch (error) {
      console.error('Error completing organization registration:', error);
      if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
        throw new Error(error.response.data.error.message);
      }
      throw new Error('Failed to complete organization registration. Please try again later.');
    }
  },
};
