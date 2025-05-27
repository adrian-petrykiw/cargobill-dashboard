// services/blockchain/solana.ts
import {
  Connection,
  Transaction,
  VersionedTransaction,
  PublicKey,
  Commitment,
  TransactionSignature,
  SignatureStatus,
  ComputeBudgetProgram,
  TransactionMessage,
} from '@solana/web3.js';
import { getAccount, TokenAccountNotFoundError, Account } from '@solana/spl-token';
import bs58 from 'bs58';
import { ConnectedSolanaWallet, PrivyClient } from '@privy-io/react-auth';
import { SolanaStandardWallet } from '@privy-io/react-auth/solana';

// Type guard to check if a transaction is a VersionedTransaction
function isVersionedTransaction(
  tx: Transaction | VersionedTransaction,
): tx is VersionedTransaction {
  return 'version' in tx;
}

export class SolanaService {
  private static instance: SolanaService;
  private _connection: Connection | null = null;

  private constructor() {
    // Initialize lazily when needed
  }

  public static getInstance(): SolanaService {
    if (!SolanaService.instance) {
      SolanaService.instance = new SolanaService();
    }
    return SolanaService.instance;
  }

  private initConnection(): Connection {
    if (this._connection) return this._connection;

    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    if (!rpcUrl) {
      throw new Error('Solana RPC URL not configured');
    }

    this._connection = new Connection(rpcUrl, {
      commitment: 'confirmed',
    });

    return this._connection;
  }

  public get connection(): Connection {
    return this.initConnection();
  }

  /**
   * Get SOL balance for a given address in SOL units (not lamports)
   */
  async getSolBalance(
    address: string | PublicKey,
    commitment: Commitment = 'confirmed',
  ): Promise<number> {
    const publicKey = typeof address === 'string' ? new PublicKey(address) : address;

    try {
      console.log(`Getting SOL balance for address: ${publicKey.toBase58()}`);

      // Get balance in lamports
      const balanceInLamports = await this.connection.getBalance(publicKey, commitment);

      // Convert lamports to SOL (1 SOL = 10^9 lamports)
      const balanceInSol = balanceInLamports / Math.pow(10, 9);

      console.log(`SOL balance: ${balanceInSol} SOL (${balanceInLamports} lamports)`);

      return balanceInSol;
    } catch (error) {
      console.error('Error fetching SOL balance:', error);
      throw error;
    }
  }

  async confirmTransactionWithRetry(
    signature: TransactionSignature,
    commitment: Commitment = 'confirmed',
    maxRetries: number = 10,
    timeoutMs: number = 60000,
    connection?: Connection,
  ): Promise<SignatureStatus | null> {
    const conn = connection || this.connection;
    const startTime = Date.now();
    let retryCount = 0;

    while (retryCount < maxRetries && Date.now() - startTime < timeoutMs) {
      try {
        console.log(`Confirmation attempt ${retryCount + 1} for ${signature}`);

        const response = await conn.getSignatureStatuses([signature]);
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

  /**
   * Debug helper function to log transaction details
   */
  private logTransactionDetails(serializedTx: string, format: 'base64' | 'bs58' = 'base64'): void {
    try {
      // Convert between formats for debugging
      let base64Tx: string;
      let bs58Tx: string;

      if (format === 'base64') {
        base64Tx = serializedTx;
        const buffer = Buffer.from(serializedTx, 'base64');
        bs58Tx = bs58.encode(buffer);
      } else {
        bs58Tx = serializedTx;
        const buffer = bs58.decode(bs58Tx);
        // Fix: Use Buffer.from() instead of buffer.toString() to handle encoding properly
        base64Tx = Buffer.from(buffer).toString('base64');
      }

      console.log('Transaction Details:', {
        format,
        length: serializedTx.length,
        base64Length: base64Tx.length,
        bs58Length: bs58Tx.length,
        // Only log the first and last part to avoid console clutter
        base64Preview: `${base64Tx.substring(0, 50)}...${base64Tx.substring(base64Tx.length - 50)}`,
        bs58Preview: `${bs58Tx.substring(0, 50)}...${bs58Tx.substring(bs58Tx.length - 50)}`,
      });

      // Try to analyze the transaction format
      const buffer =
        format === 'base64' ? Buffer.from(serializedTx, 'base64') : bs58.decode(bs58Tx);

      console.log('Buffer length:', buffer.length);

      // Check if it might be a versioned transaction
      if (buffer.length > 0) {
        const firstByte = buffer[0];
        console.log('First byte:', firstByte, '(Versioned tx should have first byte 0-127)');
      }
    } catch (error) {
      console.error('Error logging transaction details:', error);
    }
  }

  /**
   * Sign and send a transaction using Privy wallet
   * Compatible with Solana Web3.js v1 and Privy's ConnectedSolanaWallet
   */
  async signAndSendTransaction(
    serializedTransaction: string,
    privyWallet: ConnectedSolanaWallet,
    options: {
      commitment?: Commitment;
      maxRetries?: number;
      skipPreflight?: boolean;
      preflightCommitment?: Commitment;
      timeout?: number;
    } = {},
  ): Promise<{
    signature: string;
    status: SignatureStatus | null;
  }> {
    const {
      commitment = 'confirmed',
      maxRetries = 5,
      skipPreflight = true,
      preflightCommitment = 'processed',
      timeout = 30000,
    } = options;

    if (!privyWallet) {
      throw new Error('No wallet provided');
    }

    console.log('Starting transaction signing process with Privy wallet');

    console.log('TRANSACTION ANALYSIS BEFORE SIGNING:');
    this.logTransactionInfo(serializedTransaction);

    // Check if the user's wallet is in the required signers
    const { missingSigners } = this.analyzeTransactionSigners(serializedTransaction);
    const userWalletPubkey = privyWallet.address;

    if (userWalletPubkey && !missingSigners.includes(userWalletPubkey)) {
      console.warn(`User wallet ${userWalletPubkey} is NOT in the list of required signers!`);
    } else if (userWalletPubkey) {
      console.log(`User wallet ${userWalletPubkey} IS in the list of required signers.`);
    }
    try {
      // First try the direct wallet.sendTransaction method (should work for most cases)
      try {
        console.log('Using direct sendTransaction method from wallet');
        // For Privy with Web3.js v1, we need to pass the Buffer directly
        // const txBuffer = Buffer.from(serializedTransaction, 'base64');

        // // Convert to bs58 for debugging in Solana explorer
        // const bs58Tx = bs58.encode(txBuffer);
        // console.log('Transaction in bs58 format (for explorer):', bs58Tx);

        const recoveredTransaction = Transaction.from(bs58.decode(serializedTransaction));

        console.log(
          'MADE IT HERE 1: Transaction in base64 format (for explorer): ',
          Buffer.from(recoveredTransaction.serializeMessage()).toString('base64'),
        );

        console.log(
          'Recovered transaction required signers:',
          recoveredTransaction.signatures.map(
            (sig) =>
              `${sig.publicKey.toBase58()} - ${sig.signature !== null ? 'signed' : 'unsigned'}`,
          ),
        );

        const signedTransaction = await privyWallet.signTransaction(recoveredTransaction);

        console.log(
          'MADE IT HERE 2: Transaction in base64 format (for explorer): ',
          Buffer.from(signedTransaction.serializeMessage()).toString('base64'),
        );

        console.log(
          'After signing, transaction signatures:',
          (signedTransaction as Transaction).signatures.map(
            (sig) =>
              `${sig.publicKey.toBase58()} - ${sig.signature !== null ? 'signed' : 'unsigned'}`,
          ),
        );

        // Directly use the wallet's sendTransaction method (compatible with web3.js v1)
        const signature = await privyWallet.sendTransaction(signedTransaction, this.connection);
        console.log('Transaction sent with signature:', signature);

        // Confirm the transaction
        const status = await this.confirmTransactionWithRetry(
          signature,
          commitment,
          maxRetries,
          timeout,
          this.connection,
        );

        return {
          signature,
          status,
        };
      } catch (directMethodError) {
        // If direct method fails (especially for Squads complex transactions), try fallback
        console.error('Direct sendTransaction method failed:', directMethodError);
        console.log('Attempting fallback method for complex transaction...');

        // Try using the provider.request method directly (bypasses transaction deserialization)
        const provider = await privyWallet.getProvider();
        if (!provider) {
          throw new Error('Wallet provider not available');
        }

        // Convert the transaction to bs58 encoding (expected by Solana wallet adapters)
        const bs58EncodedTx = bs58.encode(Buffer.from(serializedTransaction, 'base64'));

        // Call the provider directly
        const result = await provider.request({
          method: 'sendTransaction',
          params: {
            transaction: bs58EncodedTx,
            options: {
              skipPreflight,
              preflightCommitment,
              maxRetries,
            },
          },
        });

        const fallbackSignature = result.signature;
        console.log('Transaction sent via fallback method with signature:', fallbackSignature);

        // Confirm the transaction
        const fallbackStatus = await this.confirmTransactionWithRetry(
          fallbackSignature,
          commitment,
          maxRetries,
          timeout,
          this.connection,
        );

        return {
          signature: fallbackSignature,
          status: fallbackStatus,
        };
      }
    } catch (error) {
      console.error('Error in signAndSendTransaction:', error);

      if (error instanceof Error) {
        // User rejection handling
        if (error.message.includes('User rejected')) {
          throw new Error('Transaction was rejected by the user');
        }

        // Buffer deserialization error handling - common with Squads transactions
        if (error.message.includes('Reached end of buffer')) {
          throw new Error(
            'Failed to process Squads multisig transaction. This is likely due to the complex transaction format which is a known issue.',
          );
        }

        throw error;
      } else {
        throw new Error(String(error));
      }
    }
  }

  async addPriorityFee(
    transaction: Transaction,
    feePayer: PublicKey,
    isAtomic: boolean = false,
  ): Promise<Transaction> {
    const priorityFee = await this.getPriorityFeeEstimate(transaction, feePayer, isAtomic);
    console.log(`Priority fee: ${priorityFee} microLamports`);

    const computeUnits = await this.estimateComputeUnits(
      transaction,
      this.connection,
      feePayer,
      isAtomic,
    );
    console.log(`Compute units: ${computeUnits}`);

    const modifiedTx = new Transaction();
    modifiedTx.feePayer = feePayer;

    // CRITICAL FIX: Copy the recentBlockhash from the original transaction
    if (transaction.recentBlockhash) {
      modifiedTx.recentBlockhash = transaction.recentBlockhash;
    }

    // Add compute budget instructions
    modifiedTx.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: priorityFee,
      }),
      ComputeBudgetProgram.setComputeUnitLimit({
        units: computeUnits,
      }),
    );

    // Add original instructions
    transaction.instructions.forEach((ix) => modifiedTx.add(ix));

    return modifiedTx;
  }

  async getPriorityFeeEstimate(
    transaction: Transaction,
    feePayer: PublicKey,
    isAtomic: boolean = false,
  ): Promise<number> {
    try {
      const tempTx = new Transaction().add(...transaction.instructions);
      tempTx.feePayer = feePayer;

      const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
      tempTx.recentBlockhash = blockhash;

      const message = tempTx.compileMessage();
      const accountKeys = message.accountKeys.map((key) => key.toBase58());

      if (isAtomic) {
        console.log('Atomic transaction account keys:', accountKeys);
      }

      const response = await fetch(process.env.NEXT_PUBLIC_SOLANA_RPC_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'helius-priority-fee',
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
        console.error('Priority fee API error:', data.error);
        return isAtomic ? 100000 : 50000;
      }

      console.log('Priority fee estimate:', data.result.priorityFeeEstimate);
      return data.result.priorityFeeEstimate;
    } catch (error) {
      console.error('Failed to get priority fee estimate:', error);
      return isAtomic ? 100000 : 50000;
    }
  }

  async estimateComputeUnits(
    transaction: Transaction,
    connection: Connection,
    feePayer: PublicKey,
    isAtomic: boolean = false,
  ): Promise<number> {
    try {
      const simTx = new Transaction().add(...transaction.instructions);
      simTx.feePayer = feePayer;

      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      simTx.recentBlockhash = blockhash;

      const messageV0 = new TransactionMessage({
        payerKey: feePayer,
        recentBlockhash: blockhash,
        instructions: simTx.instructions,
      }).compileToV0Message();

      const versionedTx = new VersionedTransaction(messageV0);

      const simulation = await connection.simulateTransaction(versionedTx, {
        sigVerify: false,
        replaceRecentBlockhash: true,
        commitment: 'confirmed',
      });

      if (simulation.value.err) {
        console.warn('Transaction simulation failed:', simulation.value.err);
        return this.getBaselineComputeUnits(transaction, isAtomic);
      }

      const unitsUsed = simulation.value.unitsConsumed || 0;
      const bufferMultiplier = isAtomic ? 1.5 : 1.3;
      const estimatedUnits = Math.ceil(unitsUsed * bufferMultiplier);

      const minUnits = isAtomic ? 300_000 : 200_000;
      const maxUnits = 1_400_000;

      const baselineUnits = this.getBaselineComputeUnits(transaction, isAtomic);

      const finalUnits = Math.max(
        Math.min(Math.max(estimatedUnits, baselineUnits, minUnits), maxUnits),
        minUnits,
      );

      console.log({
        isAtomic,
        simulatedUnits: unitsUsed,
        estimatedWithBuffer: estimatedUnits,
        baselineEstimate: baselineUnits,
        finalUnits,
      });

      return finalUnits;
    } catch (error) {
      console.error('Error estimating compute units:', error);
      return this.getBaselineComputeUnits(transaction, isAtomic);
    }
  }

  getBaselineComputeUnits(transaction: Transaction, isAtomic: boolean = false): number {
    const instructionCounts = transaction.instructions.reduce(
      (counts, ix) => {
        if (ix.programId.equals(new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'))) {
          counts.splTokenOps++;
        }
        if (ix.data.length > 0) {
          counts.memoSize += ix.data.length;
        }
        if (ix.programId.equals(new PublicKey('SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu'))) {
          counts.squadsOps++;
        }
        return counts;
      },
      {
        splTokenOps: 0,
        memoSize: 0,
        squadsOps: 0,
      },
    );

    const baseUnits = isAtomic ? 300_000 : 200_000;
    const splTokenUnits = instructionCounts.splTokenOps * 50_000;
    const memoUnits = Math.ceil(instructionCounts.memoSize * 100);
    const squadsUnits = instructionCounts.squadsOps * 75_000;

    return baseUnits + splTokenUnits + memoUnits + squadsUnits;
  }

  async getSolanaAccount(
    address: string | PublicKey,
    commitment: Commitment = 'confirmed',
    maxRetries = 3,
  ): Promise<Account | null> {
    const publicKey = typeof address === 'string' ? new PublicKey(address) : address;

    try {
      console.log(`Getting token account ${publicKey.toBase58()}`);
      const tokenAccount = await getAccount(this.connection, publicKey, commitment);
      console.log('Successfully retrieved token account:', tokenAccount.address.toBase58());
      return tokenAccount;
    } catch (error) {
      if (error instanceof TokenAccountNotFoundError) {
        console.log('Token account not found for', publicKey.toBase58());
        return null;
      }

      let lastError = error;
      for (let attempt = 1; attempt < maxRetries; attempt++) {
        try {
          console.log(`Retry attempt ${attempt} for token account`);
          const tokenAccount = await getAccount(this.connection, publicKey, commitment);
          console.log('Successfully retrieved token account on retry');
          return tokenAccount;
        } catch (retryError) {
          if (retryError instanceof TokenAccountNotFoundError) {
            return null;
          }
          console.error(`Retry ${attempt} failed:`, retryError);
          lastError = retryError;
          if (attempt < maxRetries - 1) {
            const delay = 1000 * Math.pow(2, attempt - 1);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }
      throw lastError;
    }
  }

  async getBalance(
    address: string | PublicKey,
    commitment: Commitment = 'confirmed',
  ): Promise<number> {
    const publicKey = typeof address === 'string' ? new PublicKey(address) : address;
    try {
      return await this.connection.getBalance(publicKey, commitment);
    } catch (error) {
      console.error('Error fetching balance:', error);
      throw error;
    }
  }

  /**
   * Analyze a transaction's signature requirements
   */
  analyzeTransactionSigners(serializedTransaction: string): {
    requiredSigners: string[];
    presentSigners: string[];
    missingSigners: string[];
  } {
    try {
      // Decode transaction
      const txBuffer = bs58.decode(serializedTransaction);
      const transaction = Transaction.from(txBuffer);

      // Get all required signers (where publicKey is set but signature is null)
      const requiredSigners = transaction.signatures.map((sig) => ({
        pubkey: sig.publicKey.toBase58(),
        isSigned: sig.signature !== null,
      }));

      // Log all signers info
      console.log(
        'Transaction signature info:',
        requiredSigners.map((s) => `${s.pubkey} - ${s.isSigned ? 'signed' : 'unsigned'}`),
      );

      // Split into signed and unsigned
      const presentSigners = requiredSigners.filter((s) => s.isSigned).map((s) => s.pubkey);

      const missingSigners = requiredSigners.filter((s) => !s.isSigned).map((s) => s.pubkey);

      return {
        requiredSigners: requiredSigners.map((s) => s.pubkey),
        presentSigners,
        missingSigners,
      };
    } catch (error) {
      console.error('Error analyzing transaction signers:', error);
      return {
        requiredSigners: [],
        presentSigners: [],
        missingSigners: [],
      };
    }
  }

  /**
   * Log detailed information about a transaction
   */
  logTransactionInfo(serializedTransaction: string): void {
    try {
      // Decode transaction
      const txBuffer = bs58.decode(serializedTransaction);
      const transaction = Transaction.from(txBuffer);

      // Basic info
      console.log('Transaction Info:');
      console.log('- Fee Payer:', transaction.feePayer?.toBase58() || 'Not set');
      console.log('- Recent Blockhash:', transaction.recentBlockhash || 'Not set');

      // Get instruction details
      console.log('- Instructions:', transaction.instructions.length);
      transaction.instructions.forEach((ix, i) => {
        console.log(`  Instruction #${i + 1}:`);
        console.log(`  - Program ID: ${ix.programId.toBase58()}`);
        console.log(`  - Data length: ${ix.data.length} bytes`);
        console.log(
          `  - Accounts:`,
          ix.keys.map(
            (k) =>
              `${k.pubkey.toBase58()} (${k.isSigner ? 'signer' : 'not-signer'}, ${k.isWritable ? 'writable' : 'read-only'})`,
          ),
        );
      });

      // Signature analysis
      const signerAnalysis = this.analyzeTransactionSigners(serializedTransaction);
      console.log('- Required Signers:', signerAnalysis.requiredSigners);
      console.log('- Already Signed By:', signerAnalysis.presentSigners);
      console.log('- Still Needs Signatures From:', signerAnalysis.missingSigners);
    } catch (error) {
      console.error('Error logging transaction info:', error);
    }
  }
}

// Export singleton instance
export const solanaService = SolanaService.getInstance();
