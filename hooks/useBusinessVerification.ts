// hooks/useBusinessVerification.ts
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { kybApi } from '@/services/api/kybApi';
import {
  DocumentType,
  BusinessBasicInfoFormData,
  VerificationStatusResponse,
} from '@/schemas/kyb.schema';

export interface UseBusinessVerificationProps {
  organizationId: string;
}

export interface DocumentStatus {
  [key: string]: boolean;
}

export function useBusinessVerification({ organizationId }: UseBusinessVerificationProps) {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [documentStatus, setDocumentStatus] = useState<DocumentStatus>({
    [DocumentType.BUSINESS_FORMATION]: false,
    [DocumentType.BUSINESS_OWNERSHIP]: false,
    [DocumentType.PROOF_OF_ADDRESS]: false,
    [DocumentType.TAX_ID]: false,
  });
  const [ownersCount, setOwnersCount] = useState<number>(1);
  const [ownersStatus, setOwnersStatus] = useState<boolean[]>([false]);

  // Save basic info
  const saveBasicInfoMutation = useMutation({
    mutationFn: (formData: BusinessBasicInfoFormData) =>
      kybApi.saveBasicInfo(organizationId, formData),
    onSuccess: () => {
      setCurrentStep(1);
    },
  });

  // Get document token
  const getDocumentTokenMutation = useMutation({
    mutationFn: ({ documentType, fields }: { documentType: DocumentType; fields: string[] }) =>
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

  // Initiate verification
  const initiateVerificationMutation = useMutation({
    mutationFn: (termsAccepted: boolean) =>
      kybApi.initiateVerification({
        organizationId,
        termsAccepted,
      }),
  });

  // Get verification status
  const verificationStatusQuery = useQuery({
    queryKey: ['verificationStatus', organizationId],
    queryFn: () => kybApi.getVerificationStatus(organizationId),
    enabled: !!organizationId,
  });

  // Helper methods
  const updateDocumentStatus = (documentType: DocumentType, isUploaded: boolean) => {
    setDocumentStatus((prev) => ({
      ...prev,
      [documentType]: isUploaded,
    }));
  };

  const updateOwnerStatus = (ownerIndex: number, isCompleted: boolean) => {
    const newStatus = [...ownersStatus];
    newStatus[ownerIndex] = isCompleted;
    setOwnersStatus(newStatus);
  };

  const updateOwnersCount = (count: number) => {
    setOwnersCount(count);
    setOwnersStatus(Array(count).fill(false));
  };

  const isDocumentsStepComplete = (): boolean => {
    return Object.values(documentStatus).every((status) => status === true);
  };

  const isOwnersStepComplete = (): boolean => {
    return ownersStatus.length > 0 && ownersStatus.every((status) => status === true);
  };

  // Return values
  return {
    // State
    currentStep,
    documentStatus,
    ownersCount,
    ownersStatus,

    // Mutations
    saveBasicInfo: saveBasicInfoMutation.mutateAsync,
    isSavingBasicInfo: saveBasicInfoMutation.isPending,

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
    setCurrentStep,
    updateDocumentStatus,
    updateOwnerStatus,
    updateOwnersCount,
    isDocumentsStepComplete,
    isOwnersStepComplete,
  };
}
