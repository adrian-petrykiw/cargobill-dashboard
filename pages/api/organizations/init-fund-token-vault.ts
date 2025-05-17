// pages/api/organizations/init-fund-token-vault.ts
import { NextApiRequest, NextApiResponse } from 'next';
import {
  Connection,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionMessage,
  VersionedTransaction,
  PublicKey,
  ComputeBudgetProgram,
  TransactionExpiredTimeoutError,
} from '@solana/web3.js';
import * as multisig from '@sqds/multisig';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import bs58 from 'bs58';
import { solanaService } from '@/services/blockchain/solana';
import { withRateLimit } from '../_middleware/rateLimiter';
import { withAuthMiddleware } from '../_middleware/withAuth';

const SOL_AMOUNT_FOR_MULTISIG = 0.003;
const SOL_AMOUNT_FOR_USER = 0.002;

const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const getPriorityFeeEstimate = async (
  connection: Connection,
  accountKeys: string[],
): Promise<number> => {
  try {
    const response = await fetch(process.env.SOLANA_RPC_URL!, {
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
              priorityLevel: 'HIGH',
              includeVote: false,
            },
          },
        ],
      }),
    });

    const data = await response.json();
    if (data.error) {
      console.error('Priority fee API error:', data.error);
      return 500000; // Fallback fee if API returns error
    }

    console.log('Priority fee estimate:', data.result.priorityFeeEstimate);
    return data.result.priorityFeeEstimate;
  } catch (error) {
    console.error('Failed to get priority fee estimate:', error);
    return 500000; // Fallback priority fee
  }
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('Init Fund Token Vault 1');

  try {
    const { userWallet, multisigPda, tokenMint } = req.body;

    if (!userWallet || !multisigPda || !tokenMint) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    console.log('Init Fund Token Vault 2');

    const connection = new Connection(process.env.SOLANA_RPC_URL!);
    const adminKeypair = Keypair.fromSecretKey(bs58.decode(process.env.CB_SERVER_MVP_PK!));

    console.log('Init Fund Token Vault 3');

    // Get the vault PDA
    const [vaultPda] = multisig.getVaultPda({
      multisigPda: new PublicKey(multisigPda),
      index: 0,
    });

    console.log('Init Fund Token Vault 4');

    // Get the vault's token ATA
    const [ata] = PublicKey.findProgramAddressSync(
      [vaultPda.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), new PublicKey(tokenMint).toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    console.log('Init Fund Token Vault 5');

    // Collect all account keys for priority fee estimation
    const accountKeys = [
      adminKeypair.publicKey.toString(),
      userWallet,
      multisigPda,
      vaultPda.toString(),
      ata.toString(),
      tokenMint,
    ];

    // Get priority fee estimate
    const priorityFee = await getPriorityFeeEstimate(connection, accountKeys);

    // Create compute budget instructions
    const computeBudgetIx = [
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 200000,
      }),
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: priorityFee,
      }),
    ];

    const instructions = [
      // Add compute budget instructions first
      ...computeBudgetIx,
      // Add rest of instructions
      SystemProgram.transfer({
        fromPubkey: adminKeypair.publicKey,
        toPubkey: vaultPda,
        lamports: SOL_AMOUNT_FOR_MULTISIG * LAMPORTS_PER_SOL,
      }),
      SystemProgram.transfer({
        fromPubkey: adminKeypair.publicKey,
        toPubkey: new PublicKey(userWallet),
        lamports: SOL_AMOUNT_FOR_USER * LAMPORTS_PER_SOL,
      }),
      createAssociatedTokenAccountInstruction(
        adminKeypair.publicKey,
        ata,
        vaultPda,
        new PublicKey(tokenMint),
      ),
    ];

    console.log('Init Fund Token Vault 6');

    const latestBlockhash = await connection.getLatestBlockhash('confirmed');
    const messageV0 = new TransactionMessage({
      payerKey: adminKeypair.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions,
    }).compileToV0Message();

    console.log('Init Fund Token Vault 7');

    const fundingTx = new VersionedTransaction(messageV0);
    fundingTx.sign([adminKeypair]);

    // Log serialized transaction for debugging
    const serializedTx = Buffer.from(fundingTx.serialize()).toString('base64');
    console.log('Serialized transaction:', serializedTx);
    console.log('Priority fee used:', priorityFee);

    console.log('Init Fund Token Vault 8');

    await delay(1000);
    console.log('awaited 2');

    try {
      console.log('starting transaction send');

      const signature = await connection.sendTransaction(fundingTx, {
        maxRetries: 5,
        skipPreflight: true,
      });

      console.log('Transaction sent with signature:', signature);

      const status = await solanaService.confirmTransactionWithRetry(
        signature,
        'confirmed',
        5,
        30000,
        connection,
      );

      console.log('Init Fund Token Vault 10');
      console.log('Transaction confirmed:', {
        signature,
        confirmations: status?.confirmations,
        confirmationStatus: status?.confirmationStatus,
        priorityFee,
      });

      return res.status(200).json({
        success: true,
        signature,
        ata: ata.toBase58(),
      });
    } catch (err: unknown) {
      console.error('Transaction failed:', err);
      if (
        err instanceof Error &&
        typeof err.message === 'string' &&
        (err.message.includes('Failed to confirm transaction') ||
          err instanceof TransactionExpiredTimeoutError)
      ) {
        return res.status(200).json({
          success: true,
          warning: 'Transaction sent but confirmation status unknown. Please check explorer.',
          error: err.message,
          signature: err.message.match(/(\w{87,88})/)?.[1] || '', // Try to extract signature from error
          ata: ata.toBase58(),
        });
      }
      throw err;
    }
  } catch (error) {
    console.error('Funding error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fund accounts',
    });
  }
}

export default withRateLimit((req, res) => withAuthMiddleware(handler)(req, res), 'standard');
