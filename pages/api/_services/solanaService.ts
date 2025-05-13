// pages/api/_services/solanaService.ts
import * as web3 from '@solana/web3.js';
import bs58 from 'bs58';

// Type guard to check if transaction is VersionedTransaction
function isVersionedTransaction(
  tx: web3.Transaction | web3.VersionedTransaction,
): tx is web3.VersionedTransaction {
  return 'version' in tx;
}

// Get environment variables
const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL!;
const connection = new web3.Connection(SOLANA_RPC_URL);

// Optional fee payer wallet for transaction sponsoring
let FEE_PAYER_KEYPAIR: web3.Keypair | null = null;
if (process.env.SOLANA_FEE_PAYER_PRIVATE_KEY) {
  try {
    const feePayerPrivateKey = bs58.decode(process.env.SOLANA_FEE_PAYER_PRIVATE_KEY);
    FEE_PAYER_KEYPAIR = web3.Keypair.fromSecretKey(feePayerPrivateKey);
    console.log('Fee payer wallet loaded with address:', FEE_PAYER_KEYPAIR.publicKey.toBase58());
  } catch (error) {
    console.error('Failed to load fee payer wallet:', error);
  }
}

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
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = from;

    // Properly serialize to ensure client can deserialize it
    const serializedTransaction = Buffer.from(transaction.serialize()).toString('base64');

    return {
      serializedTransaction,
      blockhash,
      lastValidBlockHeight,
    };
  } catch (error) {
    console.error('Error creating transaction:', error);
    throw error;
  }
}

// Create versioned transaction
export async function createVersionedTransaction(
  instructions: web3.TransactionInstruction[],
  feePayer: web3.PublicKey,
  lookupTableAddresses: string[] = [],
) {
  try {
    // Get latest blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    // Create lookup tables if provided
    let addressLookupTableAccounts: web3.AddressLookupTableAccount[] = [];
    if (lookupTableAddresses.length > 0) {
      const lookupTables = await Promise.all(
        lookupTableAddresses.map(async (address) => {
          const lookupTable = await connection.getAddressLookupTable(new web3.PublicKey(address));
          return lookupTable.value;
        }),
      );
      addressLookupTableAccounts = lookupTables.filter(Boolean) as web3.AddressLookupTableAccount[];
    }

    // Create a v0 transaction (versioned transaction)
    const messageV0 = new web3.TransactionMessage({
      payerKey: feePayer,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message(addressLookupTableAccounts);

    const transaction = new web3.VersionedTransaction(messageV0);

    // Serialize the transaction to send to the client
    const serializedTransaction = Buffer.from(transaction.serialize()).toString('base64');

    return {
      serializedTransaction,
      blockhash,
      lastValidBlockHeight,
    };
  } catch (error) {
    console.error('Error creating versioned transaction:', error);
    throw error;
  }
}

// Function to sponsor a transaction (add fee payer signature)
export async function sponsorTransaction(serializedTransaction: string) {
  if (!FEE_PAYER_KEYPAIR) {
    throw new Error('Fee payer wallet not configured for transaction sponsoring');
  }

  try {
    // Step 1: Deserialize the transaction
    const transactionBuffer = Buffer.from(serializedTransaction, 'base64');

    let transaction: web3.Transaction | web3.VersionedTransaction;
    let isVersioned = false;

    try {
      // Try to parse as a versioned transaction first
      transaction = web3.VersionedTransaction.deserialize(transactionBuffer);
      isVersioned = true;
    } catch (error) {
      // If that fails, try as a legacy transaction
      transaction = web3.Transaction.from(transactionBuffer);
    }

    // Step 2: Verify fee payer is correctly set
    if (isVersioned) {
      const versionedTx = transaction as web3.VersionedTransaction;
      const staticAccountKeys = versionedTx.message.staticAccountKeys;

      // In a versioned transaction, the first account is the fee payer
      if (!staticAccountKeys[0].equals(FEE_PAYER_KEYPAIR.publicKey)) {
        throw new Error('Fee payer mismatch in transaction');
      }
    } else {
      const legacyTx = transaction as web3.Transaction;
      if (!legacyTx.feePayer?.equals(FEE_PAYER_KEYPAIR.publicKey)) {
        throw new Error('Fee payer mismatch in transaction');
      }
    }

    // Step 3: Sign with fee payer
    if (isVersioned) {
      const versionedTx = transaction as web3.VersionedTransaction;
      // For versioned transactions, we need to add the signature
      versionedTx.sign([FEE_PAYER_KEYPAIR]);
    } else {
      const legacyTx = transaction as web3.Transaction;
      legacyTx.partialSign(FEE_PAYER_KEYPAIR);
    }

    // Step 4: Serialize for transmission back to client
    const signedSerializedTransaction = Buffer.from(
      isVersioned
        ? (transaction as web3.VersionedTransaction).serialize()
        : (transaction as web3.Transaction).serialize(),
    ).toString('base64');

    return {
      serializedTransaction: signedSerializedTransaction,
      isVersioned,
    };
  } catch (error) {
    console.error('Error sponsoring transaction:', error);
    throw error;
  }
}

// Add a priority fee to a transaction
export async function addPriorityFee(
  serializedTransaction: string,
  microLamports: number,
  computeUnits: number,
) {
  try {
    // Step 1: Deserialize the transaction
    const transactionBuffer = Buffer.from(serializedTransaction, 'base64');

    // Try to parse as a legacy transaction (priority fees are usually added to legacy transactions)
    const transaction = web3.Transaction.from(transactionBuffer);

    // Add compute budget instructions at the beginning of the transaction
    const newInstructions = [
      web3.ComputeBudgetProgram.setComputeUnitPrice({
        microLamports,
      }),
      web3.ComputeBudgetProgram.setComputeUnitLimit({
        units: computeUnits,
      }),
      ...transaction.instructions,
    ];

    // Create a new transaction with the updated instructions
    const updatedTransaction = new web3.Transaction();
    updatedTransaction.feePayer = transaction.feePayer;
    updatedTransaction.recentBlockhash = transaction.recentBlockhash;

    // Add all instructions
    for (const ix of newInstructions) {
      updatedTransaction.add(ix);
    }

    // Serialize the updated transaction
    const updatedSerializedTransaction = Buffer.from(updatedTransaction.serialize()).toString(
      'base64',
    );

    return {
      serializedTransaction: updatedSerializedTransaction,
    };
  } catch (error) {
    console.error('Error adding priority fee:', error);
    throw error;
  }
}

// Estimate priority fee based on recent transactions
export async function estimatePriorityFee(accountKeys: string[]) {
  try {
    // Use the RPC method getPriorityFeeEstimate if available (e.g., on Helius nodes)
    const response = await fetch(SOLANA_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'priority-fee-estimate',
        method: 'getPriorityFeeEstimate',
        params: [
          {
            accountKeys,
            options: {
              priorityLevel: 'High',
              includeVote: false,
            },
          },
        ],
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('Priority fee estimate error:', data.error);
      return 50000; // Default fallback if the RPC doesn't support the method
    }

    return data.result.priorityFeeEstimate;
  } catch (error) {
    console.error('Error estimating priority fee:', error);
    return 50000; // Default fallback
  }
}

// Send a transaction directly from the server
export async function sendTransaction(
  serializedTransaction: string,
  options: {
    skipPreflight?: boolean;
    maxRetries?: number;
    commitment?: web3.Commitment;
  } = {},
) {
  const { skipPreflight = false, maxRetries = 3, commitment = 'confirmed' } = options;

  try {
    // Deserialize the transaction
    const transactionBuffer = Buffer.from(serializedTransaction, 'base64');

    let isVersioned = false;
    let txid: string;

    try {
      // Try to parse as a versioned transaction
      const versionedTx = web3.VersionedTransaction.deserialize(transactionBuffer);
      isVersioned = true;
      txid = await connection.sendTransaction(versionedTx, {
        skipPreflight,
        maxRetries,
        preflightCommitment: commitment,
      });
    } catch (error) {
      // If that fails, try as a legacy transaction
      const legacyTx = web3.Transaction.from(transactionBuffer);
      txid = await connection.sendRawTransaction(legacyTx.serialize(), {
        skipPreflight,
        maxRetries,
        preflightCommitment: commitment,
      });
    }

    // Confirm transaction if requested with the correct signature format
    if (commitment !== 'processed') {
      // Use proper confirmation strategy
      const latestBlockhash = await connection.getLatestBlockhash(commitment);

      const confirmation = await connection.confirmTransaction(
        {
          signature: txid,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        },
        commitment,
      );

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }
    }

    return {
      signature: txid,
      isVersioned,
    };
  } catch (error) {
    console.error('Error sending transaction:', error);
    throw error;
  }
}

// Get account information
export async function getAccountInfo(address: string, commitment: web3.Commitment = 'confirmed') {
  try {
    const pubkey = new web3.PublicKey(address);
    const accountInfo = await connection.getAccountInfo(pubkey, commitment);
    return accountInfo;
  } catch (error) {
    console.error('Error getting account info:', error);
    throw error;
  }
}

// Get wallet SOL balance
export async function getBalance(address: string, commitment: web3.Commitment = 'confirmed') {
  try {
    const pubkey = new web3.PublicKey(address);
    const balance = await connection.getBalance(pubkey, commitment);
    return balance;
  } catch (error) {
    console.error('Error getting balance:', error);
    throw error;
  }
}

// Confirm a transaction with retry logic
export async function confirmTransactionWithRetry(
  signature: string,
  commitment: web3.Commitment = 'confirmed',
  maxRetries: number = 10,
  timeoutMs: number = 60000,
): Promise<web3.SignatureStatus | null> {
  const startTime = Date.now();
  let retryCount = 0;

  while (retryCount < maxRetries && Date.now() - startTime < timeoutMs) {
    try {
      console.log(`Confirmation attempt ${retryCount + 1} for ${signature}`);

      const response = await connection.getSignatureStatuses([signature]);
      const status = response.value[0];

      if (status) {
        if (status.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
        }

        if (commitment === 'confirmed' && status.confirmations) {
          console.log(`Transaction confirmed with ${status.confirmations} confirmations`);
          return status;
        }

        if (commitment === 'finalized' && status.confirmationStatus === 'finalized') {
          console.log('Transaction finalized');
          return status;
        }
      }

      console.log('Waiting before next confirmation check...');
      await new Promise((resolve) => setTimeout(resolve, 2000));
      retryCount++;
    } catch (error) {
      console.error(`Confirmation attempt ${retryCount + 1} failed:`, error);
      retryCount++;

      if (retryCount < maxRetries) {
        const delay = 2000 * Math.pow(2, retryCount - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  console.error(
    `Failed to confirm transaction after ${maxRetries} attempts or ${timeoutMs}ms timeout`,
  );
  return null;
}

export const solanaService = {
  connection,
  createTransferTransaction,
  createVersionedTransaction,
  sponsorTransaction,
  addPriorityFee,
  estimatePriorityFee,
  sendTransaction,
  getAccountInfo,
  getBalance,
  confirmTransactionWithRetry,
  // If fee payer is available, export its public key
  feePayerPublicKey: FEE_PAYER_KEYPAIR ? FEE_PAYER_KEYPAIR.publicKey.toBase58() : null,
};
