// pages/types/zynk.ts

// Common response type for all Zynk API endpoints
export interface ZynkResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// Entity types
export interface CreateEntityParams {
  type?: 'individual' | 'business';
  firstName: string;
  lastName: string;
  email: string;
  phoneNumberPrefix: string;
  phoneNumber: string;
  nationality: string;
  dateOfBirth: string; // ISO 8601 format (YYYY-MM-DD)
  permanentAddress: EntityAddress;
}

export interface EntityAddress {
  addressLine1: string;
  addressLine2?: string;
  locality: string;
  city: string;
  state: string;
  country: string; // 2-letter ISO country code
  postalCode: string;
}

// Account types
export interface EntityAccountParams {
  jurisdictionID: string;
  account?: {
    accountNumber: string;
    accountHolderName: string;
    bankName: string;
    bankCountry: string; // 2-letter ISO country code
    bankAddress?: string;
    bankSwiftCode?: string;
    bankRoutingNumber?: string;
    bankIban?: string;
    bankBic?: string;
    branchCode?: string;
    accountType?: 'checking' | 'savings' | 'current' | 'business' | 'other';
  };
  wallet?: {
    walletAddress: string;
  };
}

// Transfer types
export interface SimulateTransferParams {
  transactionId?: string; // Generated if not provided
  fromEntityId: string;
  fromAccountId: string;
  toEntityId: string;
  toAccountId: string;
  exactAmountIn?: number;
  exactAmountOut?: number;
}

export interface TransferParams {
  executionId: string;
  transferAcknowledgement: string;
  callbackUrl?: string;
  counterPartyRiskAcknowledged?: boolean;
}

// KYC/KYB types
export interface KycRequirement {
  fieldId: string;
  fieldName: string;
  fieldType:
    | 'section'
    | 'string'
    | 'number'
    | 'boolean'
    | 'select'
    | 'timestamp'
    | 'document'
    | 'document_list'
    | 'ip_address';
  fieldRequired: boolean;
  fieldDescription: string;
  fieldDefaultValue?: any;
  isEditable?: boolean;
  fieldChoices?: Array<{ value: string; label: string }>;
  children?: KycRequirement[];
}

export interface KycSubmissionData {
  transactionHash: string;
  [key: string]: any; // Dynamic fields based on KYC requirements
}

// Jurisdiction types
export interface Jurisdiction {
  jurisdictionId: string;
  jurisdictionName: string;
  jurisdictionType: 'country' | 'state' | 'city' | 'blockchain';
  currency: string;
  isActive: boolean;
  chainId?: string; // For blockchain jurisdictions
  tokenAddress?: string; // For blockchain jurisdictions
}

// KYC status types
export enum KycStatus {
  NOT_STARTED = 'not_started',
  INITIATED = 'initiated',
  REVIEWING = 'reviewing',
  ADDITIONAL_INFO_REQUIRED = 'additional_info_required',
  REJECTED = 'rejected',
  APPROVED = 'approved',
}

// Account Status and Types
export enum AccountType {
  CHECKING = 'checking',
  SAVINGS = 'savings',
  CURRENT = 'current',
  BUSINESS = 'business',
  OTHER = 'other',
}

// Transfer Status Types
export enum TransferStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// Error Types
export interface ZynkError {
  code: string;
  message: string;
  details?: any;
}
