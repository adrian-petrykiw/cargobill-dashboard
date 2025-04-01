// pages/api/_services/solanaService.ts
import * as web3 from '@solana/web3.js';

const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL!;
const connection = new web3.Connection(SOLANA_RPC_URL);

// Transaction creation functions
export async function createTransferTransaction(
  fromPubkey: string,
  toPubkey: string,
  amount: number,
) {
  try {
    const from = new web3.PublicKey(fromPubkey);
    const to = new web3.PublicKey(toPubkey);

    const transaction = new web3.Transaction().add(
      web3.SystemProgram.transfer({
        fromPubkey: from,
        toPubkey: to,
        lamports: amount,
      }),
    );

    // Get the latest blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = from;

    return transaction;
  } catch (error) {
    console.error('Error creating transaction:', error);
    throw error;
  }
}

// Other Solana-specific functions go here
