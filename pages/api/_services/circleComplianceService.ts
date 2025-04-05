// pages/api/_services/circleComplianceService.ts
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY;
const CIRCLE_API_URL = 'https://api.circle.com/v1';

const circleClient = axios.create({
  baseURL: CIRCLE_API_URL,
  headers: {
    Authorization: `Bearer ${CIRCLE_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

/**
 * Screen a wallet address for compliance risk
 */
export async function screenWalletAddress(address: string, chain = 'SOL') {
  try {
    const response = await circleClient.post('/w3s/compliance/screening/addresses', {
      idempotencyKey: uuidv4(), // Generate a unique ID for each request
      address,
      chain,
    });
    return response.data;
  } catch (error) {
    console.error('Wallet screening error:', error);
    throw error;
  }
}

/**
 * Screen a transaction between two wallets
 */
export async function screenTransaction(params: {
  fromWalletAddress: string;
  toWalletAddress: string;
  amount: string;
  tokenSymbol: string; // e.g., 'USDC', 'EURC'
  chain?: string; // Defaults to 'SOL' for Solana
}) {
  try {
    const { fromWalletAddress, toWalletAddress, amount, tokenSymbol, chain = 'SOL' } = params;

    // Screen both sender and recipient wallets
    const senderScreening = await screenWalletAddress(fromWalletAddress, chain);
    const recipientScreening = await screenWalletAddress(toWalletAddress, chain);

    // Determine overall risk assessment based on both wallet screenings
    const isHighRisk =
      senderScreening.result === 'DENIED' || recipientScreening.result === 'DENIED';

    const requiresReview =
      senderScreening.result === 'REVIEW' || recipientScreening.result === 'REVIEW';

    return {
      approved: !isHighRisk,
      requiresReview,
      senderScreening,
      recipientScreening,
      transactionDetails: {
        fromWalletAddress,
        toWalletAddress,
        amount,
        tokenSymbol,
        chain,
      },
    };
  } catch (error) {
    console.error('Transaction screening error:', error);
    throw error;
  }
}

export default {
  screenWalletAddress,
  screenTransaction,
};
