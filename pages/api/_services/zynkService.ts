// pages/api/_services/zynkService.ts
import axios, { AxiosInstance, AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import {
  CreateEntityParams,
  EntityAddress,
  EntityAccountParams,
  SimulateTransferParams,
  TransferParams,
  ZynkResponse,
} from '@/types/zynk';

const ZYNK_API_KEY = process.env.ZYNK_API_KEY;
const ZYNK_API_URL = 'https://qaapi.zynklabs.xyz/api/v1';

const zynkClient: AxiosInstance = axios.create({
  baseURL: ZYNK_API_URL,
  headers: {
    'X-API-Token': ZYNK_API_KEY,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

const handleZynkError = (error: unknown, operation: string) => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    console.error(`Zynk ${operation} error:`, {
      status: axiosError.response?.status,
      data: axiosError.response?.data,
    });
  } else {
    console.error(`Zynk ${operation} error:`, error);
  }
  throw error;
};

// ===== ENTITY MANAGEMENT =====

/**
 * Create a new entity (individual or business)
 */
export async function createEntity(params: CreateEntityParams): Promise<ZynkResponse> {
  try {
    const response = await zynkClient.post('/transformer/entity/create', params);
    return response.data;
  } catch (error) {
    return handleZynkError(error, 'create entity');
  }
}

/**
 * Get all entities
 */
export async function getEntities(page = 1, limit = 10): Promise<ZynkResponse> {
  try {
    const response = await zynkClient.get('/transformer/entity/entities', {
      params: { page, limit },
    });
    return response.data;
  } catch (error) {
    return handleZynkError(error, 'get entities');
  }
}

/**
 * Get entity by ID
 */
export async function getEntityById(entityId: string): Promise<ZynkResponse> {
  try {
    const response = await zynkClient.get(`/transformer/entity/${entityId}`);
    return response.data;
  } catch (error) {
    return handleZynkError(error, 'get entity by ID');
  }
}

/**
 * Get entity by email
 */
export async function getEntityByEmail(email: string): Promise<ZynkResponse> {
  try {
    const response = await zynkClient.get(`/transformer/entity/email/${email}`);
    return response.data;
  } catch (error) {
    return handleZynkError(error, 'get entity by email');
  }
}

// ===== KYC/KYB OPERATIONS =====

/**
 * Get KYC/KYB status for an entity
 */
export async function getKycStatus(entityId: string): Promise<ZynkResponse> {
  try {
    const response = await zynkClient.get(`/transformer/entity/kyc/${entityId}`);
    return response.data;
  } catch (error) {
    return handleZynkError(error, 'get KYC status');
  }
}

/**
 * Get KYC/KYB requirements for an entity and routing provider
 */
export async function getKycRequirements(
  entityId: string,
  routingId: string,
): Promise<ZynkResponse> {
  try {
    const response = await zynkClient.get(
      `/transformer/entity/kyc/requirements/${entityId}/${routingId}`,
    );
    return response.data;
  } catch (error) {
    return handleZynkError(error, 'get KYC requirements');
  }
}

/**
 * Submit KYC/KYB data for verification
 */
export async function submitKycData(
  entityId: string,
  routingId: string,
  data: any,
): Promise<ZynkResponse> {
  try {
    const response = await zynkClient.post(
      `/transformer/entity/kyc/${entityId}/${routingId}`,
      data,
    );
    return response.data;
  } catch (error) {
    return handleZynkError(error, 'submit KYC data');
  }
}

// ===== ACCOUNT MANAGEMENT =====

/**
 * Add a bank account or wallet to an entity
 */
export async function addEntityAccount(
  entityId: string,
  accountParams: EntityAccountParams,
): Promise<ZynkResponse> {
  try {
    const response = await zynkClient.post(
      `/transformer/entity/${entityId}/add/account`,
      accountParams,
    );
    return response.data;
  } catch (error) {
    return handleZynkError(error, 'add entity account');
  }
}

/**
 * Get a specific account by ID
 */
export async function getAccountById(entityId: string, accountId: string): Promise<ZynkResponse> {
  try {
    const response = await zynkClient.get(`/transformer/entity/${entityId}/account/${accountId}`);
    return response.data;
  } catch (error) {
    return handleZynkError(error, 'get account by ID');
  }
}

/**
 * Get all accounts for an entity
 */
export async function getEntityAccounts(entityId: string): Promise<ZynkResponse> {
  try {
    const response = await zynkClient.get(`/transformer/entity/${entityId}/accounts`);
    return response.data;
  } catch (error) {
    return handleZynkError(error, 'get entity accounts');
  }
}

/**
 * Remove an account from an entity
 */
export async function removeEntityAccount(
  entityId: string,
  accountId: string,
): Promise<ZynkResponse> {
  try {
    const response = await zynkClient.post(
      `/transformer/entity/${entityId}/account/remove/${accountId}`,
    );
    return response.data;
  } catch (error) {
    return handleZynkError(error, 'remove entity account');
  }
}

// ===== JURISDICTION UTILITIES =====

/**
 * Get all available jurisdictions
 */
export async function getJurisdictions(): Promise<ZynkResponse> {
  try {
    const response = await zynkClient.get('/transformer/utility/jurisdictions');
    return response.data;
  } catch (error) {
    return handleZynkError(error, 'get jurisdictions');
  }
}

// ===== TRANSFER OPERATIONS =====

/**
 * Simulate a transfer between two entities
 */
export async function simulateTransfer(params: SimulateTransferParams): Promise<ZynkResponse> {
  try {
    const response = await zynkClient.post('/transformer/transaction/simulate', {
      ...params,
      transactionId: params.transactionId || uuidv4(),
    });
    return response.data;
  } catch (error) {
    return handleZynkError(error, 'simulate transfer');
  }
}

/**
 * Execute a transfer using a previously created execution ID
 */
export async function executeTransfer(params: TransferParams): Promise<ZynkResponse> {
  try {
    const response = await zynkClient.post('/transformer/transaction/transfer', params);
    return response.data;
  } catch (error) {
    return handleZynkError(error, 'execute transfer');
  }
}

/**
 * Get details of a specific transfer by execution ID
 */
export async function getTransferByExecutionId(executionId: string): Promise<ZynkResponse> {
  try {
    const response = await zynkClient.get(`/transformer/transaction/transfer/${executionId}`);
    return response.data;
  } catch (error) {
    return handleZynkError(error, 'get transfer by execution ID');
  }
}

/**
 * Get transfers associated with an entity
 */
export async function getEntityTransfers(entityId: string): Promise<ZynkResponse> {
  try {
    const response = await zynkClient.get(`/transformer/transaction/transfers/entity/${entityId}`);
    return response.data;
  } catch (error) {
    return handleZynkError(error, 'get entity transfers');
  }
}

/**
 * Get transfer by partner transaction ID
 */
export async function getTransferByTransactionId(transactionId: string): Promise<ZynkResponse> {
  try {
    const response = await zynkClient.get(
      `/transformer/transaction/transfer/txid/${transactionId}`,
    );
    return response.data;
  } catch (error) {
    return handleZynkError(error, 'get transfer by transaction ID');
  }
}

/**
 * Get all transfers
 */
export async function getAllTransfers(): Promise<ZynkResponse> {
  try {
    const response = await zynkClient.get('/transformer/transaction/transfers');
    return response.data;
  } catch (error) {
    return handleZynkError(error, 'get all transfers');
  }
}

export default {
  // Entity Management
  createEntity,
  getEntities,
  getEntityById,
  getEntityByEmail,

  // KYC/KYB Operations
  getKycStatus,
  getKycRequirements,
  submitKycData,

  // Account Management
  addEntityAccount,
  getAccountById,
  getEntityAccounts,
  removeEntityAccount,

  // Jurisdiction Utilities
  getJurisdictions,

  // Transfer Operations
  simulateTransfer,
  executeTransfer,
  getTransferByExecutionId,
  getEntityTransfers,
  getTransferByTransactionId,
  getAllTransfers,
};
