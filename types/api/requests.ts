// types/api/requests.ts
import type {
  Organization,
  CreateOrganizationRequest as SchemaCreateOrgRequest,
  UpdateOrganizationRequest as SchemaUpdateOrgRequest,
} from '@/schemas/organization.schema';

import type {
  User,
  CreateUserRequest as SchemaCreateUserRequest,
  UpdateUserRequest as SchemaUpdateUserRequest,
} from '@/schemas/user.schema';

import type {
  Transaction,
  CreateTransactionRequest as SchemaCreateTxRequest,
  UpdateTransactionRequest as SchemaUpdateTxRequest,
} from '@/schemas/transaction.schema';

import type {
  OrganizationMember,
  CreateOrganizationMemberRequest as SchemaCreateOrgMemberRequest,
} from '@/schemas/organizationMember.schema';

// Organization Requests
export interface GetOrganizationRequest {
  id: string;
}

// Use type aliases to avoid conflicts
export type CreateOrganizationRequest = SchemaCreateOrgRequest;
export type UpdateOrganizationRequest = SchemaUpdateOrgRequest;

export interface AddOrganizationMemberRequest {
  organizationId: string;
  email: string;
  role: string;
}

export interface RemoveOrganizationMemberRequest {
  organizationId: string;
  userId: string;
}

// User Requests
export interface GetUserRequest {
  id: string;
}

export type CreateUserRequest = SchemaCreateUserRequest;
export type UpdateUserRequest = SchemaUpdateUserRequest;

// Transaction Requests
export interface GetTransactionRequest {
  id: string;
}

export interface GetOrganizationTransactionsRequest {
  organizationId: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export type CreateTransactionRequest = SchemaCreateTxRequest;
export type UpdateTransactionRequest = SchemaUpdateTxRequest;

export interface CompleteTransactionRequest {
  id: string;
  signature?: string;
  proof_data?: any;
}

// Verification Requests
export interface VerifyCodeRequest {
  code: string;
  purpose: string;
}

export interface GenerateVerificationCodeRequest {
  purpose: string;
  email?: string;
  userId?: string;
  organizationId?: string;
  metadata?: any;
  expiresInMinutes?: number;
}
