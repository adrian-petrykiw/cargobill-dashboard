// services/api/kybApi.ts
import axios from 'axios';
import type { ApiResponse } from '@/types/api/responses';

// DocumentToken request type
interface DocumentTokenRequest {
  organizationId: string;
  documentType: string;
  fields: string[];
}

// VerificationInitiationRequest type
interface VerificationInitiationRequest {
  organizationId: string;
  termsAccepted: boolean;
  formData?: Record<string, any>;
}

// Verification status response
interface VerificationStatusResponse {
  status: 'pass' | 'fail' | 'pending' | 'pending_review' | 'none' | 'verified' | 'rejected';
  requires_manual_review?: boolean;
  last_verified_at?: string | null;
  verification_provider?: string;
  verification_details?: Record<string, any>;
}

export const kybApi = {
  // Get document token for secure document upload
  async getDocumentToken(request: DocumentTokenRequest): Promise<string> {
    try {
      console.log('Requesting document token for:', request.documentType);
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

  // Get beneficial owner token for secure data collection
  async getBeneficialOwnerToken(request: {
    organizationId: string;
    ownerIndex: number;
    fields: string[];
  }): Promise<string> {
    try {
      console.log('Requesting beneficial owner token for owner index:', request.ownerIndex);
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

  // Initiate verification with Footprint
  async initiateVerification(
    request: VerificationInitiationRequest,
  ): Promise<VerificationStatusResponse> {
    try {
      console.log('Initiating verification for organization:', request.organizationId);
      const { data } = await axios.post<ApiResponse<VerificationStatusResponse>>(
        `/api/organizations/${request.organizationId}/verify`,
        {
          termsAccepted: request.termsAccepted,
          formData: request.formData, // Pass along any form data for updating org
        },
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

  // Get verification status
  async getVerificationStatus(organizationId: string): Promise<VerificationStatusResponse> {
    try {
      console.log('Getting verification status for organization:', organizationId);
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
