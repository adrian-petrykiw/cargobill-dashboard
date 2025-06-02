// pages/api/_services/squadsService.ts
import * as multisig from '@sqds/multisig';
import {
  Connection,
  PublicKey,
  Transaction,
  ComputeBudgetProgram,
  Keypair,
  TransactionMessage,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { USDC_MINT, USDT_MINT, EURC_MINT } from '@/constants/solana';
import {
  vaultTransactionExecuteSync,
  getAccountsForExecuteCore,
  transactionMessageToVaultMessage,
} from '../_utils/squadsUtils';
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
  signature: string;
  blockhash: string;
  lastValidBlockHeight: number;
}

export interface SwapTransactionParams {
  multisigAddress: string;
  transaction: TransactionMessage;
  description: string;
}

export interface SwapTransactionResult {
  signature: string;
  multisigAddress: string;
  transactionIndex: number;
}

// Updated interfaces for sponsored transactions
export interface SponsoredSwapPreparationParams {
  multisigAddress: string;
  transactionMessage: TransactionMessage;
  feePayerAddress: PublicKey;
  description: string;
}

export interface SponsoredSwapExecutionParams {
  multisigAddress: string;
  serializedSignedTransaction: string;
  originalTransactionMessage: TransactionMessage;
  description: string;
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

      // Sign with createKey and feePayer
      transaction.partialSign(createKeypair);
      transaction.partialSign(feePayer);

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
      signature, // Return signature instead of serializedTransaction
      blockhash: blockhashInfo.blockhash,
      lastValidBlockHeight: blockhashInfo.lastValidBlockHeight,
    };
  },

  /**
   * Prepare a sponsored swap transaction (unsigned, for user to sign)
   * Fixed to properly handle Squads multisig member roles
   */
  async prepareSponsoredSwapTransaction(
    params: SponsoredSwapPreparationParams,
  ): Promise<Transaction> {
    const { multisigAddress, transactionMessage, feePayerAddress, description } = params;

    try {
      // Validate inputs
      if (!multisigAddress) {
        throw new SquadsServiceError('INVALID_MULTISIG_ADDRESS', 'Multisig address is required');
      }

      if (!transactionMessage) {
        throw new SquadsServiceError('INVALID_TRANSACTION', 'Transaction message is required');
      }

      if (!process.env.SOLANA_RPC_URL) {
        throw new SquadsServiceError('MISSING_RPC_URL', 'Solana RPC URL not configured');
      }

      // Initialize connection
      const connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');

      console.log('Preparing sponsored swap transaction for multisig:', multisigAddress);

      // Convert multisig address to PublicKey
      let multisigPda: PublicKey;
      try {
        multisigPda = new PublicKey(multisigAddress);
      } catch (error) {
        throw new SquadsServiceError(
          'INVALID_MULTISIG_FORMAT',
          `Invalid multisig address format: ${multisigAddress}`,
        );
      }

      // Get vault PDA
      const [vaultPda] = multisig.getVaultPda({ multisigPda, index: 0 });
      console.log('Using vault PDA:', vaultPda.toBase58());

      // Get multisig account info and find the user member
      let multisigAccount;
      let userMember: PublicKey;

      try {
        multisigAccount = await multisig.accounts.Multisig.fromAccountAddress(
          connection,
          multisigPda,
        );

        console.log('Found multisig:', {
          threshold: multisigAccount.threshold.toString(),
          transactionIndex: multisigAccount.transactionIndex.toString(),
          membersCount: multisigAccount.members.length,
        });

        // Find the first member (should be the user since threshold is 1)
        if (multisigAccount.members.length === 0) {
          throw new SquadsServiceError('NO_MULTISIG_MEMBERS', 'Multisig has no members');
        }

        // Get the first member (the user)
        userMember = multisigAccount.members[0].key;
        console.log('Using multisig member (user):', userMember.toBase58());
      } catch (error) {
        throw new SquadsServiceError(
          'MULTISIG_NOT_FOUND',
          `Multisig account not found or invalid: ${multisigAddress}`,
          { originalError: error instanceof Error ? error.message : String(error) },
        );
      }

      // Get next transaction index
      const newTransactionIndex = BigInt(Number(multisigAccount.transactionIndex) + 1);
      console.log('Using transaction index:', newTransactionIndex);

      // Validate transaction message structure
      if (!transactionMessage.payerKey) {
        throw new SquadsServiceError(
          'INVALID_TRANSACTION_PAYER',
          'Transaction message missing payer key',
        );
      }

      if (!transactionMessage.recentBlockhash) {
        throw new SquadsServiceError(
          'INVALID_TRANSACTION_BLOCKHASH',
          'Transaction message missing recent blockhash',
        );
      }

      if (!transactionMessage.instructions || transactionMessage.instructions.length === 0) {
        throw new SquadsServiceError(
          'INVALID_TRANSACTION_INSTRUCTIONS',
          'Transaction message missing instructions',
        );
      }

      console.log('Transaction message details:', {
        payer: transactionMessage.payerKey.toBase58(),
        instructionsCount: transactionMessage.instructions.length,
        blockhash: transactionMessage.recentBlockhash,
      });

      // Create vault transaction create instruction (USER creates the proposal)
      const createIx = multisig.instructions.vaultTransactionCreate({
        multisigPda,
        transactionIndex: newTransactionIndex,
        creator: userMember, // USER creates the proposal (they are a member)
        vaultIndex: 0,
        ephemeralSigners: 0,
        transactionMessage: transactionMessage,
        memo: description,
      });

      // Create proposal approve instruction (USER approves)
      const approveIx = multisig.instructions.proposalApprove({
        multisigPda,
        transactionIndex: newTransactionIndex,
        member: userMember, // USER approves (they are a member)
      });

      // Get recent blockhash for the preparation transaction
      const { blockhash } = await connection.getLatestBlockhash();

      // Create the preparation transaction that user needs to sign
      // This transaction will create the proposal and approve it (threshold: 1)
      const preparationTransaction = new Transaction().add(createIx).add(approveIx);

      // CRITICAL: Server pays fees (sponsored transaction), but user signs as multisig member
      preparationTransaction.feePayer = feePayerAddress; // SERVER pays fees
      preparationTransaction.recentBlockhash = blockhash;

      console.log(
        'Sponsored swap preparation transaction created with',
        preparationTransaction.instructions.length,
        'instructions',
      );
      console.log('Fee payer (server):', feePayerAddress.toBase58());
      console.log('Transaction creator/approver (user):', userMember.toBase58());

      // Return unsigned transaction for user to sign
      return preparationTransaction;
    } catch (error) {
      console.error('Failed to prepare sponsored swap transaction:', error);

      if (error instanceof SquadsServiceError) {
        throw error;
      }

      throw new SquadsServiceError(
        'PREPARATION_FAILED',
        'Failed to prepare sponsored swap transaction',
        {
          originalError: error instanceof Error ? error.message : String(error),
        },
      );
    }
  },

  /**
   * Execute a sponsored swap transaction - Two-step process
   * Step 1: Create/approve proposal, Step 2: Execute approved proposal
   * FIXED: Proper type handling for vault message and ephemeral signer bumps
   */
  async executeSponsoredSwapTransaction(
    params: SponsoredSwapExecutionParams,
  ): Promise<{ signature: string; executionTransaction?: string; needsExecution?: boolean }> {
    const {
      multisigAddress,
      serializedSignedTransaction,
      originalTransactionMessage,
      description,
    } = params;

    try {
      // Validate inputs
      if (!multisigAddress) {
        throw new SquadsServiceError('INVALID_MULTISIG_ADDRESS', 'Multisig address is required');
      }

      if (!serializedSignedTransaction) {
        throw new SquadsServiceError(
          'INVALID_SIGNED_TRANSACTION',
          'Signed transaction is required',
        );
      }

      if (!process.env.SOLANA_RPC_URL) {
        throw new SquadsServiceError('MISSING_RPC_URL', 'Solana RPC URL not configured');
      }

      if (!process.env.CB_SERVER_MVP_PK) {
        throw new SquadsServiceError('MISSING_SERVER_KEY', 'Server private key not configured');
      }

      // Initialize connection and server wallet
      const connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');
      const serverWallet = Keypair.fromSecretKey(bs58.decode(process.env.CB_SERVER_MVP_PK));

      console.log(
        'Executing sponsored swap with server wallet:',
        serverWallet.publicKey.toBase58(),
      );

      // Deserialize the signed transaction (proposal creation/approval)
      let signedTransaction: Transaction;
      try {
        const txBuffer = Buffer.from(serializedSignedTransaction, 'base64');
        signedTransaction = Transaction.from(txBuffer);
      } catch (error) {
        throw new SquadsServiceError(
          'INVALID_TRANSACTION_FORMAT',
          'Failed to deserialize signed transaction',
        );
      }

      // Validate fee payer matches server wallet
      if (!signedTransaction.feePayer?.equals(serverWallet.publicKey)) {
        throw new SquadsServiceError(
          'INVALID_FEE_PAYER',
          'Transaction fee payer does not match server wallet',
        );
      }

      // Check if server wallet signature is missing (it should be, since user signed first)
      let serverSignaturePresent = false;
      for (const signature of signedTransaction.signatures) {
        if (signature.publicKey.equals(serverWallet.publicKey) && signature.signature !== null) {
          serverSignaturePresent = true;
          break;
        }
      }

      if (serverSignaturePresent) {
        throw new SquadsServiceError(
          'TRANSACTION_ALREADY_SIGNED',
          'Transaction already contains server signature',
        );
      }

      // Add server wallet signature to complete the sponsored transaction
      console.log('Adding server wallet signature to complete sponsored transaction...');
      signedTransaction.partialSign(serverWallet);

      // Send the fully signed transaction (this creates and approves the proposal)
      console.log('Broadcasting sponsored transaction (proposal creation/approval)...');

      const proposalSignature = await connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      console.log('Sponsored transaction sent (proposal ready):', proposalSignature);

      // Wait for confirmation
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        signature: proposalSignature,
        blockhash,
        lastValidBlockHeight,
      });

      console.log('Proposal creation/approval confirmed:', proposalSignature);

      // Now prepare the execution transaction (user must sign this too)
      const multisigPda = new PublicKey(multisigAddress);
      const multisigAccount = await multisig.accounts.Multisig.fromAccountAddress(
        connection,
        multisigPda,
      );

      const executionTransactionIndex = BigInt(Number(multisigAccount.transactionIndex));
      console.log('Preparing execution for transaction index:', executionTransactionIndex);

      // Get the user member (first member since threshold is 1)
      const userMember = multisigAccount.members[0].key;
      console.log('User member who must execute:', userMember.toBase58());

      // Get vault PDA
      const [vaultPda] = multisig.getVaultPda({ multisigPda, index: 0 });

      // Get the transaction account to get ephemeral signer bumps
      const [transactionPda] = multisig.getTransactionPda({
        multisigPda,
        index: executionTransactionIndex,
      });

      const transactionAccount = await multisig.accounts.VaultTransaction.fromAccountAddress(
        connection,
        transactionPda,
      );

      // CRITICAL FIX: Recreate the transaction message from original (like TransactionConfirmation.tsx)
      // Don't use the stored vault message directly due to type incompatibility
      const freshTransactionMessage = new TransactionMessage({
        payerKey: originalTransactionMessage.payerKey,
        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
        instructions: originalTransactionMessage.instructions,
      });

      console.log('Recreated transaction message:', {
        payerKey: freshTransactionMessage.payerKey.toBase58(),
        instructionsCount: freshTransactionMessage.instructions.length,
        blockhash: freshTransactionMessage.recentBlockhash,
      });

      // Compile to vault message using the utility function
      const compiledVaultMessage = transactionMessageToVaultMessage({
        message: freshTransactionMessage,
        addressLookupTableAccounts: [],
        vaultPda,
      });

      // Convert ephemeral signer bumps from Uint8Array to number[]
      const ephemeralSignerBumpsArray = Array.from(transactionAccount.ephemeralSignerBumps);

      console.log('Execution preparation details:', {
        vaultPda: vaultPda.toBase58(),
        transactionPda: transactionPda.toBase58(),
        ephemeralSignerBumps: ephemeralSignerBumpsArray,
        messageType: 'recreated_and_compiled',
      });

      // Get accounts for execution with proper types
      const { accountMetas, lookupTableAccounts } = await getAccountsForExecuteCore({
        connection,
        multisigPda,
        message: compiledVaultMessage, // Now properly typed
        ephemeralSignerBumps: ephemeralSignerBumpsArray, // Now properly converted
        vaultIndex: 0,
        transactionPda,
        programId: multisig.PROGRAM_ID,
      });

      // CRITICAL FIX: Create execution instruction with USER as member (not server)
      const { instruction: executeIx } = vaultTransactionExecuteSync({
        multisigPda,
        transactionIndex: executionTransactionIndex,
        member: userMember, // USER must be the member (only members can execute)
        accountsForExecute: accountMetas,
        altAccounts: lookupTableAccounts,
      });

      // Create execution transaction with server as fee payer
      const executionTransaction = new Transaction().add(executeIx);
      executionTransaction.feePayer = serverWallet.publicKey; // SERVER pays fees (sponsored)
      executionTransaction.recentBlockhash = blockhash;

      console.log('Execution transaction prepared:', {
        member: userMember.toBase58(),
        feePayer: serverWallet.publicKey.toBase58(),
        transactionIndex: executionTransactionIndex.toString(),
      });

      // Serialize execution transaction for user to sign
      const serializedExecutionTransaction = Buffer.from(executionTransaction.serialize()).toString(
        'base64',
      );

      // Return execution transaction for user to sign
      return {
        signature: proposalSignature, // Proposal creation signature
        executionTransaction: serializedExecutionTransaction, // User needs to sign this
        needsExecution: true, // Indicates a second step is needed
      };
    } catch (error) {
      console.error('Failed to execute sponsored swap transaction:', error);

      if (error instanceof SquadsServiceError) {
        throw error;
      }

      throw new SquadsServiceError(
        'SPONSORED_EXECUTION_FAILED',
        'Failed to execute sponsored swap transaction',
        {
          originalError: error instanceof Error ? error.message : String(error),
        },
      );
    }
  },

  /**
   * Finalize sponsored swap execution (step 2)
   * Handle user-signed execution transaction
   */
  async finalizeSponsoredSwapExecution(params: {
    serializedSignedExecutionTransaction: string;
  }): Promise<{ signature: string }> {
    try {
      if (!process.env.SOLANA_RPC_URL) {
        throw new SquadsServiceError('MISSING_RPC_URL', 'Solana RPC URL not configured');
      }

      if (!process.env.CB_SERVER_MVP_PK) {
        throw new SquadsServiceError('MISSING_SERVER_KEY', 'Server private key not configured');
      }

      // Initialize connection and server wallet
      const connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');
      const serverWallet = Keypair.fromSecretKey(bs58.decode(process.env.CB_SERVER_MVP_PK));

      console.log('Finalizing sponsored swap execution...');

      // Deserialize the user-signed execution transaction
      let signedExecutionTransaction: Transaction;
      try {
        const txBuffer = Buffer.from(params.serializedSignedExecutionTransaction, 'base64');
        signedExecutionTransaction = Transaction.from(txBuffer);
      } catch (error) {
        throw new SquadsServiceError(
          'INVALID_EXECUTION_TRANSACTION_FORMAT',
          'Failed to deserialize signed execution transaction',
        );
      }

      // Validate fee payer matches server wallet
      if (!signedExecutionTransaction.feePayer?.equals(serverWallet.publicKey)) {
        throw new SquadsServiceError(
          'INVALID_EXECUTION_FEE_PAYER',
          'Execution transaction fee payer does not match server wallet',
        );
      }

      // Check if server wallet signature is missing (it should be)
      let serverSignaturePresent = false;
      for (const signature of signedExecutionTransaction.signatures) {
        if (signature.publicKey.equals(serverWallet.publicKey) && signature.signature !== null) {
          serverSignaturePresent = true;
          break;
        }
      }

      if (serverSignaturePresent) {
        throw new SquadsServiceError(
          'EXECUTION_ALREADY_SIGNED',
          'Execution transaction already contains server signature',
        );
      }

      // Add server wallet signature to complete the sponsored execution
      console.log('Adding server signature to execution transaction...');
      signedExecutionTransaction.partialSign(serverWallet);

      // Send the fully signed execution transaction
      console.log('Broadcasting sponsored execution transaction...');

      const executionSignature = await connection.sendRawTransaction(
        signedExecutionTransaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        },
      );

      console.log('Sponsored execution transaction sent:', executionSignature);

      // Wait for execution confirmation
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        signature: executionSignature,
        blockhash,
        lastValidBlockHeight,
      });

      console.log('Sponsored swap execution fully completed:', executionSignature);

      // Return the execution signature (the actual swap transaction)
      return { signature: executionSignature };
    } catch (error) {
      console.error('Failed to finalize sponsored swap execution:', error);

      if (error instanceof SquadsServiceError) {
        throw error;
      }

      throw new SquadsServiceError(
        'SPONSORED_EXECUTION_FINALIZATION_FAILED',
        'Failed to finalize sponsored swap execution',
        {
          originalError: error instanceof Error ? error.message : String(error),
        },
      );
    }
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
