// pages/api/_services/bankingService.ts
import axios, { AxiosInstance, AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Banking API configuration
const BANKING_API_KEY =
  process.env.BANKING_API_KEY || '91855428ab9f4308ffdbb5627c9f52bf75f4377ee0b100d73fbfff33d1564cba'; // Default to QA key
const BANKING_API_URL =
  process.env.BANKING_API_URL || 'https://slipstreamdev.datavysta.com/api/rest';
const DEFAULT_ACCOUNT_ID = process.env.BANKING_ACCOUNT_ID || '5719939'; // Default to QA account

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
 * Get transaction history for an account
 * @param params Transaction query parameters
 * @returns Transaction history
 */
export async function getTransactionHistory(
  params: TransactionsParams = { accountID: DEFAULT_ACCOUNT_ID },
): Promise<TransactionsResponse> {
  try {
    const response = await bankingClient.post('/workflows/Transactions', params);
    return response.data;
  } catch (error) {
    return handleBankingError(error, 'get transaction history');
  }
}

/**
 * Get transaction history for the default account
 * @param options Optional parameters like date range and pagination
 * @returns Transaction history
 */
export async function getDefaultAccountTransactions(
  options: Omit<TransactionsParams, 'accountID'> = {},
): Promise<TransactionsResponse> {
  return getTransactionHistory({ accountID: DEFAULT_ACCOUNT_ID, ...options });
}

/**
 * Get a specific transaction by ID
 * @param transactionId The transaction ID to look up
 * @param accountID The account ID (defaults to the default account)
 * @returns The transaction if found, or null
 */
export async function getTransactionById(
  transactionId: number,
  accountID: string = DEFAULT_ACCOUNT_ID,
): Promise<BankingTransaction | null> {
  try {
    const transactions = await getTransactionHistory({ accountID });
    const transaction = transactions.values.find((t) => t.transaction_id === transactionId);
    return transaction || null;
  } catch (error) {
    return handleBankingError(error, 'get transaction by ID');
  }
}

/**
 * Check account balance
 * Note: This is a placeholder function - you'll need to implement it based on
 * the actual endpoint from the banking API once you have the documentation for it
 */
export async function getAccountBalance(accountID: string = DEFAULT_ACCOUNT_ID): Promise<any> {
  try {
    // This is a placeholder - replace with actual endpoint when available
    const response = await bankingClient.post('/workflows/AccountBalance', { accountID });
    return response.data;
  } catch (error) {
    return handleBankingError(error, 'get account balance');
  }
}

/**
 * Create an outgoing payment
 * Note: This is a placeholder function - you'll need to implement it based on
 * the actual endpoint from the banking API once you have the documentation for it
 */
export async function createPayment(params: any): Promise<any> {
  try {
    // This is a placeholder - replace with actual endpoint when available
    const paymentParams = {
      idempotencyKey: uuidv4(), // Prevent duplicate payments
      ...params,
    };
    const response = await bankingClient.post('/workflows/Payment', paymentParams);
    return response.data;
  } catch (error) {
    return handleBankingError(error, 'create payment');
  }
}

export default {
  getTransactionHistory,
  getDefaultAccountTransactions,
  getTransactionById,
  getAccountBalance,
  createPayment,
};
