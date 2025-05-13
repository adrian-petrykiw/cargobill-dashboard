// services/api/kybApi.ts
import axios from 'axios';
import type { ApiResponse } from '@/types/api/responses';
import {
  DocumentTokenRequest,
  BeneficialOwnerTokenRequest,
  VerificationInitiationRequest,
  VerificationStatusResponse,
  BusinessBasicInfoFormData,
} from '@/schemas/kyb.schema';

export const kybApi = {
  async saveBasicInfo(organizationId: string, data: BusinessBasicInfoFormData): Promise<void> {
    try {
      const { data: response } = await axios.patch<ApiResponse<void>>(
        `/api/organizations/${organizationId}`,
        {
          name: data.name,
          business_type: data.businessType,
          primary_business_purpose: 'Logistics Payments',
          business_description: data.businessDescription,
          is_intermediary: data.isIntermediary === 'yes',
          website: data.website,
          phone_number: data.phoneNumber,
          email: data.email,
          countries_of_operation: data.countriesOfOperation,
          verification_status: 'in_progress',
        },
      );

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to save business information');
      }
    } catch (error) {
      console.error('Error saving basic information:', error);
      if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
        throw new Error(error.response.data.error.message);
      }
      throw new Error('Failed to save business information. Please try again later.');
    }
  },

  async getDocumentToken(request: DocumentTokenRequest): Promise<string> {
    try {
      const { data } = await axios.post<ApiResponse<{ token: string }>>(
        '/api/footprint/document-token',
        request,
      );

      if (!data.success || !data.data) {
        throw new Error(data.error?.message || 'Failed to get document upload token');
      }

      return data.data.token;
    } catch (error) {
      console.error('Error getting document token:', error);
      if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
        throw new Error(error.response.data.error.message);
      }
      throw new Error('Failed to get document upload token. Please try again later.');
    }
  },

  async getBeneficialOwnerToken(request: BeneficialOwnerTokenRequest): Promise<string> {
    try {
      const { data } = await axios.post<ApiResponse<{ token: string }>>(
        '/api/footprint/beneficial-owner-token',
        request,
      );

      if (!data.success || !data.data) {
        throw new Error(data.error?.message || 'Failed to get beneficial owner token');
      }

      return data.data.token;
    } catch (error) {
      console.error('Error getting beneficial owner token:', error);
      if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
        throw new Error(error.response.data.error.message);
      }
      throw new Error('Failed to get beneficial owner token. Please try again later.');
    }
  },

  async initiateVerification(
    request: VerificationInitiationRequest,
  ): Promise<VerificationStatusResponse> {
    try {
      const { data } = await axios.post<ApiResponse<VerificationStatusResponse>>(
        `/api/organizations/${request.organizationId}/verify`,
        { termsAccepted: request.termsAccepted },
      );

      if (!data.success || !data.data) {
        throw new Error(data.error?.message || 'Failed to initiate verification');
      }

      return data.data;
    } catch (error) {
      console.error('Error initiating verification:', error);
      if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
        throw new Error(error.response.data.error.message);
      }
      throw new Error('Failed to initiate verification. Please try again later.');
    }
  },

  async getVerificationStatus(organizationId: string): Promise<VerificationStatusResponse> {
    try {
      const { data } = await axios.get<ApiResponse<VerificationStatusResponse>>(
        `/api/organizations/${organizationId}/verification-status`,
      );

      if (!data.success || !data.data) {
        throw new Error(data.error?.message || 'Failed to get verification status');
      }

      return data.data;
    } catch (error) {
      console.error('Error getting verification status:', error);
      if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
        throw new Error(error.response.data.error.message);
      }
      throw new Error('Failed to get verification status. Please try again later.');
    }
  },
};
