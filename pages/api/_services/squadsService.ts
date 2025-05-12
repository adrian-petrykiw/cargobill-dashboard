// pages/api/_services/squadsService.ts
import * as multisig from '@sqds/multisig';
import { Connection, PublicKey, Transaction, ComputeBudgetProgram, Keypair } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { USDC_MINT, USDT_MINT, EURC_MINT } from '@/constants/solana';
import bs58 from 'bs58';

const { Permissions } = multisig.types;

export class SquadsServiceError extends Error {
  code: string;
  details?: any;

  constructor(code: string, message: string, details?: any) {
    super(message);
    this.name = 'SquadsServiceError';
    this.code = code;
    this.details = details;
  }
}

export interface CreateMultisigParams {
  userWalletAddress: string;
  organizationName: string;
}

export interface MultisigTransactionResult {
  multisigPda: string;
  createKey: string;
  serializedTransaction: string;
  blockhash: string;
  lastValidBlockHeight: number;
}

export const squadsService = {
  async createMultisigTransaction(
    params: CreateMultisigParams,
  ): Promise<MultisigTransactionResult> {
    // Validate inputs first
    if (!params.userWalletAddress) {
      throw new SquadsServiceError('INVALID_USER_WALLET', 'User wallet address is required');
    }

    if (!params.organizationName) {
      throw new SquadsServiceError('INVALID_ORG_NAME', 'Organization name is required');
    }

    // Validate wallet address format
    try {
      new PublicKey(params.userWalletAddress);
    } catch (error) {
      throw new SquadsServiceError(
        'INVALID_WALLET_FORMAT',
        `Invalid wallet address format: ${params.userWalletAddress.substring(0, 8)}...`,
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }

    // Check server configuration
    if (!process.env.SOLANA_RPC_URL) {
      throw new SquadsServiceError('MISSING_RPC_URL', 'Solana RPC URL not configured');
    }

    if (!process.env.CB_SERVER_MVP_PK) {
      throw new SquadsServiceError(
        'MISSING_SERVER_WALLET',
        'Server wallet private key not configured',
      );
    }

    let connection: Connection;
    try {
      connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');
    } catch (error) {
      throw new SquadsServiceError(
        'CONNECTION_FAILED',
        'Failed to establish connection to Solana',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }

    let feePayer: Keypair;
    try {
      feePayer = Keypair.fromSecretKey(bs58.decode(process.env.CB_SERVER_MVP_PK));
    } catch (error) {
      throw new SquadsServiceError('INVALID_SERVER_KEY', 'Invalid server wallet private key', {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }

    const userPublicKey = new PublicKey(params.userWalletAddress);
    const createKey = userPublicKey;

    // Generate PDAs
    let multisigPda: PublicKey;
    let vaultPda: PublicKey;
    try {
      [multisigPda] = multisig.getMultisigPda({ createKey });
      [vaultPda] = multisig.getVaultPda({ multisigPda, index: 0 });
    } catch (error) {
      throw new SquadsServiceError(
        'PDA_GENERATION_FAILED',
        'Failed to generate PDAs for multisig',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }

    // Get program config
    let programConfig;
    try {
      const programConfigPda = multisig.getProgramConfigPda({})[0];
      programConfig = await multisig.accounts.ProgramConfig.fromAccountAddress(
        connection,
        programConfigPda,
      );
    } catch (error) {
      throw new SquadsServiceError(
        'PROGRAM_CONFIG_FETCH_FAILED',
        'Failed to fetch Squads program configuration',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }

    // Create multisig instruction
    let createIx;
    try {
      createIx = multisig.instructions.multisigCreateV2({
        createKey,
        creator: feePayer.publicKey,
        multisigPda,
        configAuthority: null,
        threshold: 1,
        members: [
          {
            key: userPublicKey,
            permissions: Permissions.all(),
          },
        ],
        timeLock: 0,
        treasury: programConfig.treasury,
        rentCollector: null,
      });
    } catch (error) {
      throw new SquadsServiceError(
        'MULTISIG_INSTRUCTION_FAILED',
        'Failed to create multisig instruction',
        {
          originalError: error instanceof Error ? error.message : String(error),
          context: {
            createKey: createKey.toBase58(),
            multisigPda: multisigPda.toBase58(),
            treasury: programConfig?.treasury?.toBase58() || 'undefined',
          },
        },
      );
    }

    // Create token ATAs for the vault
    // const atas = await Promise.all([
    //   this.createTokenATAInstruction(vaultPda, USDC_MINT, feePayer.publicKey),
    //   this.createTokenATAInstruction(vaultPda, USDT_MINT, feePayer.publicKey),
    //   this.createTokenATAInstruction(vaultPda, EURC_MINT, feePayer.publicKey),
    // ]);

    // const instructions = [createIx, ...atas];

    // Add compute budget for complex transactions
    const computeBudgetIx = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 }),
    ];

    // Get blockhash
    let blockhashInfo;
    try {
      blockhashInfo = await connection.getLatestBlockhash('finalized');
    } catch (error) {
      throw new SquadsServiceError('BLOCKHASH_FETCH_FAILED', 'Failed to fetch recent blockhash', {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }

    // Create and sign transaction
    let serializedTransaction;
    try {
      const transaction = new Transaction();
      // transaction.add(...computeBudgetIx, ...instructions);
      transaction.add(...computeBudgetIx, createIx);
      transaction.feePayer = feePayer.publicKey;
      transaction.recentBlockhash = blockhashInfo.blockhash;

      // Sign with fee payer only
      transaction.partialSign(feePayer);

      serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
      });
    } catch (error) {
      throw new SquadsServiceError(
        'TRANSACTION_CREATION_FAILED',
        'Failed to create or sign transaction',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }

    return {
      multisigPda: multisigPda.toBase58(),
      createKey: createKey.toBase58(),
      serializedTransaction: bs58.encode(serializedTransaction),
      blockhash: blockhashInfo.blockhash,
      lastValidBlockHeight: blockhashInfo.lastValidBlockHeight,
    };
  },

  async createTokenATAInstruction(vaultPda: PublicKey, tokenMint: PublicKey, payer: PublicKey) {
    try {
      const [ata] = PublicKey.findProgramAddressSync(
        [vaultPda.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), tokenMint.toBuffer()],
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );

      return createAssociatedTokenAccountInstruction(payer, ata, vaultPda, tokenMint);
    } catch (error) {
      throw new SquadsServiceError(
        'ATA_INSTRUCTION_FAILED',
        `Failed to create token ATA instruction for mint ${tokenMint.toBase58()}`,
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },
};
