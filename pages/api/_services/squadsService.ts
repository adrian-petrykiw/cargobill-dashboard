// pages/api/_services/squadsService.ts (minimal changes to your existing)
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
    const connection = new Connection(process.env.SOLANA_RPC_URL!, 'confirmed');

    if (!process.env.CB_SERVER_MVP_PK) {
      throw new Error('Server wallet not configured');
    }

    const feePayer = Keypair.fromSecretKey(bs58.decode(process.env.CB_SERVER_MVP_PK));
    const userPublicKey = new PublicKey(params.userWalletAddress);
    const createKey = userPublicKey;

    const [multisigPda] = multisig.getMultisigPda({ createKey });
    const [vaultPda] = multisig.getVaultPda({ multisigPda, index: 0 });

    // Get program config for treasury
    const programConfigPda = multisig.getProgramConfigPda({})[0];
    const programConfig = await multisig.accounts.ProgramConfig.fromAccountAddress(
      connection,
      programConfigPda,
    );

    // Create multisig instruction
    const createIx = multisig.instructions.multisigCreateV2({
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

    // Create token ATAs for the vault
    const atas = await Promise.all([
      this.createTokenATAInstruction(vaultPda, USDC_MINT, feePayer.publicKey),
      this.createTokenATAInstruction(vaultPda, USDT_MINT, feePayer.publicKey),
      this.createTokenATAInstruction(vaultPda, EURC_MINT, feePayer.publicKey),
    ]);

    const instructions = [createIx, ...atas];

    // Add compute budget for complex transactions
    const computeBudgetIx = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 }),
    ];

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
    const transaction = new Transaction();
    transaction.add(...computeBudgetIx, ...instructions);
    transaction.feePayer = feePayer.publicKey;
    transaction.recentBlockhash = blockhash;

    // Sign with fee payer only
    transaction.partialSign(feePayer);

    return {
      multisigPda: multisigPda.toBase58(),
      createKey: createKey.toBase58(),
      serializedTransaction: bs58.encode(
        transaction.serialize({
          requireAllSignatures: false,
        }),
      ),
      blockhash,
      lastValidBlockHeight,
    };
  },

  // Keep the same createTokenATAInstruction method
  async createTokenATAInstruction(vaultPda: PublicKey, tokenMint: PublicKey, payer: PublicKey) {
    const [ata] = PublicKey.findProgramAddressSync(
      [vaultPda.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), tokenMint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    return createAssociatedTokenAccountInstruction(payer, ata, vaultPda, tokenMint);
  },
};
