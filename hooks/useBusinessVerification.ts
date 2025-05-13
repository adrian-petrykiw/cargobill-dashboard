// hooks/useBusinessVerification.ts
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { kybApi } from '@/services/api/kybApi';
import { DocumentType, VerificationStatusResponse } from '@/schemas/kyb.schema';

export interface UseBusinessVerificationProps {
  organizationId: string;
}

export interface DocumentStatus {
  [key: string]: boolean;
}

export function useBusinessVerification({ organizationId }: UseBusinessVerificationProps) {
  // Document upload status tracking
  const [documentStatus, setDocumentStatus] = useState<DocumentStatus>({
    [DocumentType.BUSINESS_FORMATION]: false,
    [DocumentType.BUSINESS_OWNERSHIP]: false,
    [DocumentType.PROOF_OF_ADDRESS]: false,
    [DocumentType.TAX_ID]: false,
    ownerIdFront: false,
    ownerIdBack: false,
    ownerProofOfAddress: false,
    // Country-specific documents can be added as needed
    companyPanCard: false,
    gstCertificate: false,
    memorandumOfAssociation: false,
    itrDocument: false,
    shareholderRegistry: false,
  });

  // Get document token
  const getDocumentTokenMutation = useMutation({
    mutationFn: ({ documentType, fields }: { documentType: string; fields: string[] }) =>
      kybApi.getDocumentToken({
        organizationId,
        documentType,
        fields,
      }),
  });

  // Get beneficial owner token
  const getBeneficialOwnerTokenMutation = useMutation({
    mutationFn: ({ ownerIndex, fields }: { ownerIndex: number; fields: string[] }) =>
      kybApi.getBeneficialOwnerToken({
        organizationId,
        ownerIndex,
        fields,
      }),
  });

  // Initiate verification with support for form data
  const initiateVerificationMutation = useMutation({
    mutationFn: (params: { termsAccepted: boolean; formData?: Record<string, any> }) =>
      kybApi.initiateVerification({
        organizationId,
        termsAccepted: params.termsAccepted,
        formData: params.formData,
      }),
  });

  // Get verification status
  const verificationStatusQuery = useQuery({
    queryKey: ['verificationStatus', organizationId],
    queryFn: () => kybApi.getVerificationStatus(organizationId),
    enabled: !!organizationId,
  });

  // Helper methods
  const updateDocumentStatus = (documentType: string, isUploaded: boolean) => {
    setDocumentStatus((prev) => ({
      ...prev,
      [documentType]: isUploaded,
    }));
  };

  // Return values - simplified for SimpleVerificationForm
  return {
    // State
    documentStatus,

    // Mutations
    getDocumentToken: getDocumentTokenMutation.mutateAsync,
    isGettingDocumentToken: getDocumentTokenMutation.isPending,

    getBeneficialOwnerToken: getBeneficialOwnerTokenMutation.mutateAsync,
    isGettingBeneficialOwnerToken: getBeneficialOwnerTokenMutation.isPending,

    initiateVerification: initiateVerificationMutation.mutateAsync,
    isInitiatingVerification: initiateVerificationMutation.isPending,
    verificationResult: initiateVerificationMutation.data,

    // Query
    verificationStatus: verificationStatusQuery.data,
    isLoadingStatus: verificationStatusQuery.isLoading,

    // Helper methods
    updateDocumentStatus,
  };
}
