// pages/api/_services/privyService.ts
import { PrivyClient } from '@privy-io/server-auth';

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;

// Create a singleton instance
export const privyClient = new PrivyClient(PRIVY_APP_ID!, PRIVY_APP_SECRET!);

// Authentication functions
export async function verifyToken(token: string) {
  try {
    return await privyClient.verifyAuthToken(token);
  } catch (error) {
    console.error('Token verification error:', error);
    throw error;
  }
}

export async function getUser(userId: string) {
  try {
    return await privyClient.getUser(userId);
  } catch (error) {
    console.error('Get user error:', error);
    throw error;
  }
}

// Other Privy-specific functions go here
