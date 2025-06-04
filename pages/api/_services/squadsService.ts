// pages/api/_services/squadsService.ts
import * as multisig from '@sqds/multisig';
import {
  Connection,
  PublicKey,
  Transaction,
  ComputeBudgetProgram,
  Keypair,
  VersionedTransaction,
  TransactionMessage,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  createTransferInstruction,
} from '@solana/spl-token';
import { USDC_MINT, USDT_MINT, EURC_MINT, TOKENS } from '@/constants/solana';
import bs58 from 'bs58';
import {
  vaultTransactionExecuteSync,
  getAccountsForExecuteCore,
  transactionMessageToVaultMessage,
} from '../_utils/squadsUtils';

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
  signature: string;
  blockhash: string;
  lastValidBlockHeight: number;
}

export interface SponsoredTransactionRequest {
  serializedTransaction: string;
  expectedFeeAmount: number;
  tokenMint: string;
  userWalletAddress: string;
  organizationId: string;
}

export interface FeeCollectionRequest {
  amount: number;
  tokenMint: string;
  userWalletAddress: string;
  organizationId: string;
}

export interface CreateVaultTransactionParams {
  multisigPda: string;
  creator: string;
  vaultIndex: number;
  ephemeralSigners: number;
  transactionMessage: TransactionMessage;
  memo?: string;
}

export interface CreateProposalParams {
  multisigPda: string;
  transactionIndex: bigint;
  creator: string;
  isDraft?: boolean;
}

export interface ApproveProposalParams {
  multisigPda: string;
  transactionIndex: bigint;
  member: string;
}

export interface ExecuteVaultTransactionParams {
  multisigPda: string;
  transactionIndex: bigint;
  member: string;
  transactionMessage: TransactionMessage;
  vaultIndex?: number;
  ephemeralSignerBumps?: number[];
}

export interface CreateConfigTransactionParams {
  multisigPda: string;
  transactionIndex: bigint;
  creator: string;
  actions: any[];
}

export interface ExecuteConfigTransactionParams {
  multisigPda: string;
  transactionIndex: bigint;
  member: string;
}

export interface CreateBatchParams {
  multisigPda: string;
  batchIndex: bigint;
  creator: string;
  vaultIndex: number;
  memo?: string;
}

export interface AddToBatchParams {
  multisigPda: string;
  batchIndex: bigint;
  transactionIndex: bigint;
  member: string;
  vaultIndex: number;
  transactionMessage: TransactionMessage;
  ephemeralSigners: number;
}

export interface CreatePaymentTransactionParams {
  organizationMultisigAddress: string;
  userWalletAddress: string;
  transactionIndex: bigint;
  transferMessage: TransactionMessage;
  memo: string;
}

export interface CreatePaymentTransactionResult {
  createTransaction: string;
  proposeTransaction: string;
  executeTransaction: string;
  transactionIndex: string;
  multisigAddress: string;
  vaultAddress: string;
  blockhash: string;
  lastValidBlockHeight: number;
}

// Internal function to get server components (NEVER expose outside this service)
async function getSecureServerComponents(): Promise<{
  connection: Connection;
  serverWallet: Keypair;
}> {
  if (!process.env.CB_SERVER_MVP_PK) {
    throw new SquadsServiceError(
      'MISSING_SERVER_WALLET',
      'Server wallet private key not configured',
    );
  }

  if (!process.env.SOLANA_RPC_URL) {
    throw new SquadsServiceError('MISSING_RPC_URL', 'Solana RPC URL not configured');
  }

  try {
    const connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');
    const serverWallet = Keypair.fromSecretKey(bs58.decode(process.env.CB_SERVER_MVP_PK));
    return { connection, serverWallet };
  } catch (error) {
    throw new SquadsServiceError(
      'INITIALIZATION_FAILED',
      'Failed to initialize secure server components',
      { originalError: error instanceof Error ? error.message : String(error) },
    );
  }
}

export const squadsService = {
  // Create multisig transaction
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

    // Get server components internally
    const { connection, serverWallet: feePayer } = await getSecureServerComponents();

    const userPublicKey = new PublicKey(params.userWalletAddress);

    // Random keypair
    const createKeypair = Keypair.generate();
    const createKey = createKeypair.publicKey;

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
        treasury: programConfig.treasury,
        creator: feePayer.publicKey,
        multisigPda: multisigPda,
        configAuthority: null,
        threshold: 1,
        members: [
          {
            key: userPublicKey,
            permissions: Permissions.all(),
          },
        ],
        timeLock: 0,
        rentCollector: null,
        createKey: createKey,
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

    // Create, sign, and send transaction
    let signature;
    try {
      const transaction = new Transaction();
      transaction.add(...computeBudgetIx, createIx);
      transaction.feePayer = feePayer.publicKey;
      transaction.recentBlockhash = blockhashInfo.blockhash;

      // Log all required signers before signing
      console.log(
        'Required signers BEFORE signing:',
        transaction.signatures.map(
          (sig) => `${sig.publicKey.toBase58()} - ${sig.signature ? 'Signed' : 'Unsigned'}`,
        ),
      );

      // Sign with createKey and feePayer
      transaction.partialSign(createKeypair);
      transaction.partialSign(feePayer);

      // Log all required signers after signing to verify
      console.log(
        'Required signers AFTER signing:',
        transaction.signatures.map(
          (sig) => `${sig.publicKey.toBase58()} - ${sig.signature ? 'Signed' : 'Unsigned'}`,
        ),
      );

      // Check if there are any remaining unsigned signers
      const unsignedSigners = transaction.signatures
        .filter((sig) => sig.signature === null)
        .map((sig) => sig.publicKey.toBase58());

      if (unsignedSigners.length > 0) {
        console.warn('Transaction still has unsigned signers:', unsignedSigners);
        throw new SquadsServiceError(
          'MISSING_SIGNATURES',
          `Transaction still requires signatures from: ${unsignedSigners.join(', ')}`,
          { unsignedSigners },
        );
      }

      // Submit transaction directly from server
      signature = await connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      console.log('Transaction submitted with signature:', signature);

      // Wait for confirmation
      const confirmationResult = await connection.confirmTransaction(
        {
          signature,
          blockhash: blockhashInfo.blockhash,
          lastValidBlockHeight: blockhashInfo.lastValidBlockHeight,
        },
        'confirmed',
      );

      if (confirmationResult.value.err) {
        throw new Error(
          `Transaction confirmed but failed: ${JSON.stringify(confirmationResult.value.err)}`,
        );
      }

      console.log('Transaction confirmed successfully');
    } catch (error) {
      console.error('Transaction submission failed:', error);
      throw new SquadsServiceError(
        'TRANSACTION_SUBMISSION_FAILED',
        'Failed to submit transaction',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }

    return {
      multisigPda: multisigPda.toBase58(),
      createKey: createKey.toBase58(),
      signature,
      blockhash: blockhashInfo.blockhash,
      lastValidBlockHeight: blockhashInfo.lastValidBlockHeight,
    };
  },

  // Create vault transaction instruction
  async createVaultTransactionInstruction(
    params: CreateVaultTransactionParams,
  ): Promise<{ instruction: TransactionInstruction; transactionIndex: bigint }> {
    try {
      const multisigPda = new PublicKey(params.multisigPda);
      const creator = new PublicKey(params.creator);

      // Get server components internally
      const { connection } = await getSecureServerComponents();

      // Get multisig account info for transaction index
      const multisigInfo = await multisig.accounts.Multisig.fromAccountAddress(
        connection,
        multisigPda,
      );

      const currentTransactionIndex = Number(multisigInfo.transactionIndex);
      const newTransactionIndex = BigInt(currentTransactionIndex + 1);

      console.log('🔒 Creating vault transaction instruction with secure server wallet');

      const instruction = multisig.instructions.vaultTransactionCreate({
        multisigPda,
        transactionIndex: newTransactionIndex,
        creator,
        vaultIndex: params.vaultIndex,
        ephemeralSigners: params.ephemeralSigners,
        transactionMessage: params.transactionMessage,
        memo: params.memo || '',
      });

      return {
        instruction,
        transactionIndex: newTransactionIndex,
      };
    } catch (error) {
      throw new SquadsServiceError(
        'VAULT_TRANSACTION_INSTRUCTION_FAILED',
        'Failed to create vault transaction instruction',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  // Create proposal instruction
  async createProposalInstruction(params: CreateProposalParams): Promise<TransactionInstruction> {
    try {
      const multisigPda = new PublicKey(params.multisigPda);
      const creator = new PublicKey(params.creator);

      console.log('🔒 Creating proposal instruction with secure server wallet');

      return multisig.instructions.proposalCreate({
        multisigPda,
        transactionIndex: params.transactionIndex,
        creator,
        isDraft: params.isDraft || false,
      });
    } catch (error) {
      throw new SquadsServiceError(
        'PROPOSAL_INSTRUCTION_FAILED',
        'Failed to create proposal instruction',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  // Create proposal approve instruction
  async approveProposalInstruction(params: ApproveProposalParams): Promise<TransactionInstruction> {
    try {
      const multisigPda = new PublicKey(params.multisigPda);
      const member = new PublicKey(params.member);

      console.log('🔒 Creating proposal approve instruction with secure server wallet');

      return multisig.instructions.proposalApprove({
        multisigPda,
        transactionIndex: params.transactionIndex,
        member,
      });
    } catch (error) {
      throw new SquadsServiceError(
        'APPROVE_PROPOSAL_INSTRUCTION_FAILED',
        'Failed to create approve proposal instruction',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  // Create execute vault transaction instruction
  async executeVaultTransactionInstruction(
    params: ExecuteVaultTransactionParams,
  ): Promise<TransactionInstruction> {
    try {
      const multisigPda = new PublicKey(params.multisigPda);
      const member = new PublicKey(params.member);

      // Get server components internally
      const { connection } = await getSecureServerComponents();

      console.log('🔒 Creating execute vault transaction instruction with secure server wallet');

      // Get vault PDA
      const vaultIndex = params.vaultIndex || 0;
      const [vaultPda] = multisig.getVaultPda({
        multisigPda,
        index: vaultIndex,
      });

      // Get transaction PDA
      const [transactionPda] = multisig.getTransactionPda({
        multisigPda,
        index: params.transactionIndex,
      });

      // Convert transaction message to vault message format
      const compiledMessage = transactionMessageToVaultMessage({
        message: params.transactionMessage,
        addressLookupTableAccounts: [],
        vaultPda: vaultPda,
      });

      // Get execution accounts using backend utils
      const { accountMetas } = await getAccountsForExecuteCore({
        connection: connection,
        multisigPda: multisigPda,
        message: compiledMessage,
        ephemeralSignerBumps: params.ephemeralSignerBumps || [0],
        vaultIndex: vaultIndex,
        transactionPda,
        programId: multisig.PROGRAM_ID,
      });

      // Create execute instruction using backend utils
      const { instruction } = vaultTransactionExecuteSync({
        multisigPda: multisigPda,
        transactionIndex: params.transactionIndex,
        member: member,
        accountsForExecute: accountMetas,
        programId: multisig.PROGRAM_ID,
      });

      return instruction;
    } catch (error) {
      throw new SquadsServiceError(
        'EXECUTE_VAULT_TRANSACTION_INSTRUCTION_FAILED',
        'Failed to create execute vault transaction instruction',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  // Create config transaction instruction
  async createConfigTransactionInstruction(
    params: CreateConfigTransactionParams,
  ): Promise<TransactionInstruction> {
    try {
      const multisigPda = new PublicKey(params.multisigPda);
      const creator = new PublicKey(params.creator);

      console.log('🔒 Creating config transaction instruction with secure server wallet');

      return multisig.instructions.configTransactionCreate({
        multisigPda,
        transactionIndex: params.transactionIndex,
        creator,
        actions: params.actions,
      });
    } catch (error) {
      throw new SquadsServiceError(
        'CONFIG_TRANSACTION_INSTRUCTION_FAILED',
        'Failed to create config transaction instruction',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  // Create execute config transaction instruction
  async executeConfigTransactionInstruction(
    params: ExecuteConfigTransactionParams,
  ): Promise<TransactionInstruction> {
    try {
      const multisigPda = new PublicKey(params.multisigPda);
      const member = new PublicKey(params.member);

      console.log('🔒 Creating execute config transaction instruction with secure server wallet');

      return multisig.instructions.configTransactionExecute({
        multisigPda,
        transactionIndex: params.transactionIndex,
        member,
      });
    } catch (error) {
      throw new SquadsServiceError(
        'EXECUTE_CONFIG_TRANSACTION_INSTRUCTION_FAILED',
        'Failed to create execute config transaction instruction',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  // Create batch instruction
  async createBatchInstruction(params: CreateBatchParams): Promise<TransactionInstruction> {
    try {
      const multisigPda = new PublicKey(params.multisigPda);
      const creator = new PublicKey(params.creator);

      console.log('🔒 Creating batch instruction with secure server wallet');

      return multisig.instructions.batchCreate({
        batchIndex: params.batchIndex,
        creator,
        multisigPda,
        vaultIndex: params.vaultIndex,
        memo: params.memo || '',
      });
    } catch (error) {
      throw new SquadsServiceError(
        'BATCH_INSTRUCTION_FAILED',
        'Failed to create batch instruction',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  // Add to batch instruction
  async addToBatchInstruction(params: AddToBatchParams): Promise<TransactionInstruction> {
    try {
      const multisigPda = new PublicKey(params.multisigPda);
      const member = new PublicKey(params.member);

      console.log('🔒 Creating add to batch instruction with secure server wallet');

      // 🔧 FIX: Convert bigint to number for transactionIndex
      return multisig.instructions.batchAddTransaction({
        batchIndex: params.batchIndex,
        multisigPda,
        vaultIndex: params.vaultIndex,
        transactionMessage: params.transactionMessage,
        transactionIndex: Number(params.transactionIndex), // 🔧 Convert bigint to number
        ephemeralSigners: params.ephemeralSigners,
        member,
      });
    } catch (error) {
      throw new SquadsServiceError(
        'ADD_TO_BATCH_INSTRUCTION_FAILED',
        'Failed to create add to batch instruction',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  // Complete payment transaction creation
  async createPaymentTransaction(
    params: CreatePaymentTransactionParams,
  ): Promise<CreatePaymentTransactionResult> {
    try {
      // Get server components internally
      const { connection, serverWallet } = await getSecureServerComponents();

      const organizationMultisigAddress = new PublicKey(params.organizationMultisigAddress);
      const userWalletAddress = new PublicKey(params.userWalletAddress);

      console.log('🔒 Creating payment transactions');

      const [vaultPda] = multisig.getVaultPda({
        multisigPda: organizationMultisigAddress,
        index: 0,
      });
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

      // Create the squads instructions using our secure methods
      const createResult = await this.createVaultTransactionInstruction({
        multisigPda: organizationMultisigAddress.toString(),
        creator: userWalletAddress.toString(),
        vaultIndex: 0,
        ephemeralSigners: 0,
        transactionMessage: params.transferMessage,
        memo: params.memo,
      });

      const createIx = createResult.instruction;
      const transactionIndex = createResult.transactionIndex;

      const proposeIx = await this.createProposalInstruction({
        multisigPda: organizationMultisigAddress.toString(),
        transactionIndex: transactionIndex,
        creator: userWalletAddress.toString(),
      });

      const approveIx = await this.approveProposalInstruction({
        multisigPda: organizationMultisigAddress.toString(),
        transactionIndex: transactionIndex,
        member: userWalletAddress.toString(),
      });

      const executeIx = await this.executeVaultTransactionInstruction({
        multisigPda: organizationMultisigAddress.toString(),
        transactionIndex: transactionIndex,
        member: userWalletAddress.toString(),
        transactionMessage: params.transferMessage,
        vaultIndex: 0,
        ephemeralSignerBumps: [0],
      });

      console.log('🔒 Building transactions');

      // Create the CREATE transaction
      const createMessage = new TransactionMessage({
        payerKey: serverWallet.publicKey,
        recentBlockhash: blockhash,
        instructions: [createIx],
      }).compileToV0Message();

      const createTransaction = new VersionedTransaction(createMessage);

      // Create the PROPOSE + APPROVE transaction
      const proposeMessage = new TransactionMessage({
        payerKey: serverWallet.publicKey,
        recentBlockhash: blockhash,
        instructions: [proposeIx, approveIx],
      }).compileToV0Message();

      const proposeTransaction = new VersionedTransaction(proposeMessage);

      // Create the EXECUTE transaction
      const executeMessage = new TransactionMessage({
        payerKey: serverWallet.publicKey,
        recentBlockhash: blockhash,
        instructions: [executeIx],
      }).compileToV0Message();

      const executeTransaction = new VersionedTransaction(executeMessage);

      console.log(
        '✅ Payment transactions created successfully with secure server wallet as fee payer',
      );

      return {
        createTransaction: Buffer.from(createTransaction.serialize()).toString('base64'),
        proposeTransaction: Buffer.from(proposeTransaction.serialize()).toString('base64'),
        executeTransaction: Buffer.from(executeTransaction.serialize()).toString('base64'),
        transactionIndex: transactionIndex.toString(),
        multisigAddress: organizationMultisigAddress.toString(),
        vaultAddress: vaultPda.toString(),
        blockhash,
        lastValidBlockHeight,
      };
    } catch (error) {
      throw new SquadsServiceError(
        'PAYMENT_TRANSACTION_CREATION_FAILED',
        'Failed to create payment transactions',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },

  // Create new ATA for token
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

  // Complete fee sponsored transaction
  async completeSponsoredTransaction(
    request: SponsoredTransactionRequest,
  ): Promise<{ signature: string }> {
    // Get server components internally
    const { connection, serverWallet: feePayer } = await getSecureServerComponents();

    try {
      // Deserialize the transaction
      const transactionBuffer = Buffer.from(request.serializedTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(transactionBuffer);

      // Verify the transaction structure
      const message = transaction.message;
      const accountKeys = message.getAccountKeys();
      const feePayerIndex = 0;
      const transactionFeePayer = accountKeys.get(feePayerIndex);

      if (
        !transactionFeePayer ||
        transactionFeePayer.toBase58() !== feePayer.publicKey.toBase58()
      ) {
        throw new SquadsServiceError(
          'INVALID_FEE_PAYER',
          'Transaction does not use the correct fee payer',
        );
      }

      // Enhanced security check: Verify that the transaction doesn't attempt to transfer funds from the fee payer
      for (const instruction of message.compiledInstructions) {
        const programId = accountKeys.get(instruction.programIdIndex);

        // Check for token transfers that might drain the fee payer
        if (programId && programId.toBase58() === TOKEN_PROGRAM_ID.toBase58()) {
          const instructionData = instruction.data;

          // Check for Transfer instruction (instruction type 3 in SPL Token)
          if (instructionData.length > 0 && instructionData[0] === 3) {
            const sourceAccountIndex = instruction.accountKeyIndexes[0];
            const sourceAccount = accountKeys.get(sourceAccountIndex);

            // Prevent transfers from any account associated with the fee payer
            // This is a simplified check - in production you might want more sophisticated validation
            if (sourceAccount && sourceAccount.toBase58() === feePayer.publicKey.toBase58()) {
              throw new SquadsServiceError(
                'UNAUTHORIZED_TRANSFER',
                'Transaction attempts to transfer funds from fee payer account',
              );
            }
          }
        }
      }

      // Log transaction details for debugging
      console.log('🔒 Sponsoring transaction with secure server wallet:', {
        accountKeysCount: accountKeys.length,
        instructionsCount: message.compiledInstructions.length,
        feePayer: feePayer.publicKey.toBase58(),
        transactionFeePayer: transactionFeePayer.toBase58(),
        organizationId: request.organizationId,
        tokenMint: request.tokenMint,
      });

      // Sign the transaction with the fee payer
      transaction.sign([feePayer]);

      // Send the transaction
      const signature = await connection.sendTransaction(transaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });

      console.log('✅ Sponsored transaction sent with signature:', signature);

      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');

      if (confirmation.value.err) {
        throw new SquadsServiceError(
          'TRANSACTION_FAILED',
          `Sponsored transaction failed: ${JSON.stringify(confirmation.value.err)}`,
        );
      }

      console.log('✅ Sponsored transaction confirmed successfully');
      return { signature };
    } catch (error) {
      console.error('❌ Error completing sponsored transaction:', error);

      if (error instanceof SquadsServiceError) {
        throw error;
      }

      throw new SquadsServiceError(
        'SPONSORED_TRANSACTION_FAILED',
        'Failed to complete sponsored transaction',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  },
};
