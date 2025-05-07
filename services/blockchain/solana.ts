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
  Signer,
} from '@solana/web3.js';
import { getAccount, TokenAccountNotFoundError, Account } from '@solana/spl-token';
import { useSolanaWallets } from '@privy-io/react-auth/solana';
import bs58 from 'bs58';

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

  async signAndSendTransaction(
    serializedTransaction: string,
    embeddedWallet?: any,
    options: {
      commitment?: Commitment;
      maxRetries?: number;
      skipPreflight?: boolean;
      preflightCommitment?: Commitment;
      timeout?: number;
    } = {},
  ): Promise<{
    signature: string;
    signedTransaction: Transaction | VersionedTransaction;
    status: SignatureStatus | null;
  }> {
    const {
      commitment = 'confirmed',
      maxRetries = 5,
      skipPreflight = true,
      preflightCommitment = 'processed',
      timeout = 30000,
    } = options;

    // Get wallet if not provided
    let wallet = embeddedWallet;
    if (!wallet) {
      const { wallets } = useSolanaWallets();
      wallet = wallets.find((w) => w.walletClientType === 'privy');
      if (!wallet) {
        throw new Error('No embedded wallet found');
      }
    }

    // Deserialize the transaction
    const transaction = Transaction.from(Buffer.from(serializedTransaction, 'base64'));

    // Sign transaction
    const signedTransaction = await wallet.signTransaction(transaction);

    // Send the signed transaction
    const signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
      skipPreflight,
      preflightCommitment,
      maxRetries,
    });

    console.log('Transaction sent with signature:', signature);

    // Confirm the transaction
    const status = await this.confirmTransactionWithRetry(
      signature,
      commitment,
      maxRetries,
      timeout,
      this.connection,
    );

    return { signature, signedTransaction, status };
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
}

// Export singleton instance
export const solanaService = SolanaService.getInstance();
