// pages/api/_services/bankingService.ts
import axios, { AxiosInstance, AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Banking API configuration
const BANKING_API_KEY =
  process.env.BANKING_API_KEY || '91855428ab9f4308ffdbb5627c9f52bf75f4377ee0b100d73fbfff33d1564cba'; // Default to QA key
const BANKING_API_URL =
  process.env.BANKING_API_URL || 'https://slipstreamdev.datavysta.com/api/rest';
const QA_CUSTOMER_ID = '5719939'; // QA customer ID

// Helper function to get customerID for development environment
const getDevCustomerId = (customerID?: string): string => {
  // In development, use QA ID as fallback. In production, require explicit ID
  if (!customerID && process.env.NODE_ENV === 'development') {
    return QA_CUSTOMER_ID;
  }
  if (!customerID) {
    throw new Error('Customer ID is required');
  }
  return customerID;
};

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
  accountID: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface CreateAccountParams {
  customerID: string;
}

export interface CreateAccountResponse {
  BankAccountID: string;
}

export interface AccountInfoParams {
  customerID: string;
  accountID: string;
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
 * Create a new bank account for a customer
 * @param customerID Optional customer ID (required in production)
 * @returns Response with the new bank account ID
 */
export async function createAccount(customerID?: string): Promise<CreateAccountResponse> {
  try {
    const resolvedCustomerId = getDevCustomerId(customerID);
    const response = await bankingClient.post('/workflows/CreateAccount', {
      customerID: resolvedCustomerId,
    });
    return response.data;
  } catch (error) {
    return handleBankingError(error, 'create account');
  }
}

/**
 * Get account information
 * @param accountID The account ID
 * @param customerID Optional customer ID (required in production)
 * @returns Account details
 */
export async function getAccountInfo(
  accountID: string,
  customerID?: string,
): Promise<AccountInfoResponse> {
  try {
    const resolvedCustomerId = getDevCustomerId(customerID);
    const response = await bankingClient.post('/workflows/AccountInfo', {
      customerID: resolvedCustomerId,
      accountID,
    });
    return response.data;
  } catch (error) {
    return handleBankingError(error, 'get account info');
  }
}

/**
 * Get transaction history for an account
 * @param accountID The account ID to get transactions for
 * @returns Transaction history
 */
export async function getTransactionHistory(
  accountID: string,
  options: Omit<TransactionsParams, 'accountID'> = {},
): Promise<TransactionsResponse> {
  try {
    const params = { accountID, ...options };
    const response = await bankingClient.post('/workflows/Transactions', params);
    return response.data;
  } catch (error) {
    return handleBankingError(error, 'get transaction history');
  }
}

/**
 * Get a specific transaction by ID
 * @param transactionId The transaction ID to look up
 * @param accountID The account ID to search in
 * @returns The transaction if found, or null
 */
export async function getTransactionById(
  transactionId: number,
  accountID: string,
): Promise<BankingTransaction | null> {
  try {
    const transactions = await getTransactionHistory(accountID);
    const transaction = transactions.values.find((t) => t.transaction_id === transactionId);
    return transaction || null;
  } catch (error) {
    return handleBankingError(error, 'get transaction by ID');
  }
}

/**
 * Check if an account exists and is active
 * @param accountID The account ID to check
 * @param customerID Optional customer ID (required in production)
 * @returns Boolean indicating if account is active
 */
export async function isAccountActive(accountID: string, customerID?: string): Promise<boolean> {
  try {
    const resolvedCustomerId = getDevCustomerId(customerID);
    const accountInfo = await getAccountInfo(accountID, resolvedCustomerId);
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
 * Get account details including routing and account numbers
 * @param accountID The account ID to get details for
 * @param customerID Optional customer ID (required in production)
 * @returns Account details including routing and account numbers
 */
export async function getAccountDetails(
  accountID: string,
  customerID?: string,
): Promise<AccountDetail | null> {
  try {
    const resolvedCustomerId = getDevCustomerId(customerID);
    const accountInfo = await getAccountInfo(accountID, resolvedCustomerId);
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
  createAccount,
  getAccountInfo,
  getTransactionHistory,
  getTransactionById,
  isAccountActive,
  getAccountDetails,
};
