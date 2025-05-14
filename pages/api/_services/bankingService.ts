// pages/api/_services/bankingService.ts
import axios, { AxiosInstance, AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Banking API configuration
const BANKING_API_KEY =
  process.env.BANKING_API_KEY || '91855428ab9f4308ffdbb5627c9f52bf75f4377ee0b100d73fbfff33d1564cba'; // Default to QA key
const BANKING_API_URL =
  process.env.BANKING_API_URL || 'https://slipstreamdev.datavysta.com/api/rest';

// Types for Banking API
export interface BankingTransaction {
  transaction_id: number;
  transaction_amount: string;
  transaction_method: string;
  transaction_name: string;
  transaction_type: string;
  transaction_status: string;
  transaction_date: string;
  purpose: string;
  class: string;
  status_reason: string;
  allow_duplicate: boolean;
  created_by: string;
  changed_by: string;
}

export interface TransactionsResponse {
  values: BankingTransaction[];
}

export interface TransactionsParams {
  accountID: string; // This is a BankAccountID (sub-account ID)
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface CreateSubAccountResponse {
  BankAccountID: string; // The ID of the newly created sub-account
}

export interface AccountInfoParams {
  customerID: string; // Organization/FBO ID
  accountID: string; // BankAccountID (sub-account ID)
}

export interface AccountDetail {
  account_id: string;
  account_type: string;
  account_name: string;
  account_status: string;
  routing_num: string;
  account_num: string;
  routing_account: string;
}

export interface AccountInfoResponse {
  AccountDetail: AccountDetail[];
}

export interface BankingError {
  error: string;
}

// Create API client
const bankingClient: AxiosInstance = axios.create({
  baseURL: BANKING_API_URL,
  headers: {
    'x-api-key': BANKING_API_KEY,
    'Content-Type': 'application/json',
  },
});

// Error handling function
const handleBankingError = (error: unknown, operation: string) => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<BankingError>;
    console.error(`Banking ${operation} error:`, {
      status: axiosError.response?.status,
      data: axiosError.response?.data,
    });
  } else {
    console.error(`Banking ${operation} error:`, error);
  }
  throw error;
};

/**
 * Create a new sub-account under our main FBO account
 * @param customerID Our organization's customer ID
 * @returns Response with the new bank sub-account ID
 */
export async function createSubAccount(customerID: string): Promise<CreateSubAccountResponse> {
  try {
    // Note: The API expects "accountID" but this is actually the customerID
    // This is a naming inconsistency in the Slipstream API
    const response = await bankingClient.post('/workflows/CreateAccount', {
      accountID: customerID,
    });
    return response.data;
  } catch (error) {
    return handleBankingError(error, 'create sub-account');
  }
}

/**
 * Get account information for a sub-account
 * @param bankAccountID The bank sub-account ID
 * @param customerID Our organization's customer ID
 * @returns Account details
 */
export async function getAccountInfo(
  bankAccountID: string,
  customerID: string,
): Promise<AccountInfoResponse> {
  try {
    const response = await bankingClient.post('/workflows/AccountInfo', {
      customerID,
      accountID: bankAccountID,
    });
    return response.data;
  } catch (error) {
    return handleBankingError(error, 'get account info');
  }
}

/**
 * Get transaction history for a sub-account
 * @param bankAccountID The sub-account ID to get transactions for
 * @param options Additional options like date range and pagination
 * @returns Transaction history
 */
export async function getTransactionHistory(
  bankAccountID: string,
  options: Omit<TransactionsParams, 'accountID'> = {},
): Promise<TransactionsResponse> {
  try {
    const params = { accountID: bankAccountID, ...options };
    const response = await bankingClient.post('/workflows/Transactions', params);
    return response.data;
  } catch (error) {
    return handleBankingError(error, 'get transaction history');
  }
}

/**
 * Get a specific transaction by ID
 * @param transactionId The transaction ID to look up
 * @param bankAccountID The sub-account ID to search in
 * @returns The transaction if found, or null
 */
export async function getTransactionById(
  transactionId: number,
  bankAccountID: string,
): Promise<BankingTransaction | null> {
  try {
    const transactions = await getTransactionHistory(bankAccountID);
    const transaction = transactions.values.find((t) => t.transaction_id === transactionId);
    return transaction || null;
  } catch (error) {
    return handleBankingError(error, 'get transaction by ID');
  }
}

/**
 * Check if a sub-account exists and is active
 * @param bankAccountID The sub-account ID to check
 * @param customerID Our organization's customer ID
 * @returns Boolean indicating if account is active
 */
export async function isAccountActive(bankAccountID: string, customerID: string): Promise<boolean> {
  try {
    const accountInfo = await getAccountInfo(bankAccountID, customerID);
    if (!accountInfo.AccountDetail || accountInfo.AccountDetail.length === 0) {
      return false;
    }
    return accountInfo.AccountDetail[0].account_status === 'ACTIVE';
  } catch (error) {
    console.error('Error checking if account is active:', error);
    return false;
  }
}

/**
 * Get sub-account details including routing and account numbers
 * @param bankAccountID The sub-account ID to get details for
 * @param customerID Our organization's customer ID
 * @returns Account details including routing and account numbers
 */
export async function getAccountDetails(
  bankAccountID: string,
  customerID: string,
): Promise<AccountDetail | null> {
  try {
    const accountInfo = await getAccountInfo(bankAccountID, customerID);
    if (!accountInfo.AccountDetail || accountInfo.AccountDetail.length === 0) {
      return null;
    }
    return accountInfo.AccountDetail[0];
  } catch (error) {
    handleBankingError(error, 'get account details');
    return null;
  }
}

export default {
  createSubAccount,
  getAccountInfo,
  getTransactionHistory,
  getTransactionById,
  isAccountActive,
  getAccountDetails,
};
