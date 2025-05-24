// lib/helpers/squadsUtils.ts

import {
  AccountMeta,
  AddressLookupTableAccount,
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
} from '@solana/web3.js';
import * as multisig from '@sqds/multisig';

interface VaultTransactionExecuteSyncArgs {
  multisigPda: PublicKey;
  transactionIndex: bigint;
  member: PublicKey;
  accountsForExecute: AccountMeta[];
  altAccounts?: AddressLookupTableAccount[];
  programId?: PublicKey;
}

interface FormatAccountsForExecuteArgs {
  connection: Connection;
  message: multisig.types.TransactionMessage;
  ephemeralSignerBumps: number[];
  vaultPda: PublicKey;
  transactionPda: PublicKey;
  programId?: PublicKey;
}

interface TransactionMessageToVaultMessageArgs {
  message: TransactionMessage;
  addressLookupTableAccounts: AddressLookupTableAccount[];
  vaultPda: PublicKey;
}

interface GetAccountsForExecuteCoreArgs {
  connection: Connection;
  multisigPda: PublicKey;
  message: multisig.types.TransactionMessage;
  ephemeralSignerBumps: number[];
  vaultIndex: number;
  transactionPda: PublicKey;
  programId?: PublicKey;
}

interface OptimizedAtomicResult {
  transactions: Transaction[];
  isAtomic: boolean;
}

export function vaultTransactionExecuteSync({
  multisigPda,
  transactionIndex,
  member,
  accountsForExecute,
  altAccounts,
  programId = multisig.PROGRAM_ID,
}: VaultTransactionExecuteSyncArgs): {
  instruction: TransactionInstruction;
  lookupTableAccounts: AddressLookupTableAccount[];
} {
  const [proposalPda] = multisig.getProposalPda({
    multisigPda,
    transactionIndex,
    programId,
  });
  const [transactionPda] = multisig.getTransactionPda({
    multisigPda,
    index: transactionIndex,
    programId,
  });

  return {
    instruction: multisig.generated.createVaultTransactionExecuteInstruction(
      {
        multisig: multisigPda,
        member,
        proposal: proposalPda,
        transaction: transactionPda,
        anchorRemainingAccounts: accountsForExecute,
      },
      programId,
    ),
    lookupTableAccounts: altAccounts ? [...altAccounts] : [],
  };
}

export async function getAccountsForExecuteCore({
  connection,
  multisigPda,
  message,
  transactionPda,
  vaultIndex,
  ephemeralSignerBumps,
  programId,
}: GetAccountsForExecuteCoreArgs): Promise<{
  accountMetas: AccountMeta[];
  lookupTableAccounts: AddressLookupTableAccount[];
}> {
  const [vaultPda] = multisig.getVaultPda({
    multisigPda,
    index: vaultIndex,
    programId: programId ?? multisig.PROGRAM_ID,
  });

  return await accountsForTransactionExecuteCore({
    connection,
    message,
    ephemeralSignerBumps: [...ephemeralSignerBumps],
    vaultPda,
    transactionPda,
    programId,
  });
}

export async function accountsForTransactionExecuteCore({
  connection,
  transactionPda,
  vaultPda,
  message,
  ephemeralSignerBumps,
  programId,
}: FormatAccountsForExecuteArgs): Promise<{
  accountMetas: AccountMeta[];
  lookupTableAccounts: AddressLookupTableAccount[];
}> {
  const ephemeralSignerPdas = ephemeralSignerBumps.map((_, additionalSignerIndex) => {
    return multisig.getEphemeralSignerPda({
      transactionPda,
      ephemeralSignerIndex: additionalSignerIndex,
      programId,
    })[0];
  });

  const addressLookupTableKeys = message.addressTableLookups.map(({ accountKey }) => accountKey);
  const addressLookupTableAccounts = new Map(
    await Promise.all(
      addressLookupTableKeys.map(async (key) => {
        const { value } = await connection.getAddressLookupTable(key);
        if (!value) {
          throw new Error(`Address lookup table account ${key.toBase58()} not found`);
        }
        return [key.toBase58(), value] as const;
      }),
    ),
  );

  const accountMetas: AccountMeta[] = [];
  accountMetas.push(
    ...addressLookupTableKeys.map((key) => {
      return { pubkey: key, isSigner: false, isWritable: false };
    }),
  );
  for (const [accountIndex, accountKey] of message.accountKeys.entries()) {
    accountMetas.push({
      pubkey: accountKey,
      isWritable: isStaticWritableIndex(message, accountIndex),
      isSigner:
        isSignerIndex(message, accountIndex) &&
        !accountKey.equals(vaultPda) &&
        !ephemeralSignerPdas.find((k) => accountKey.equals(k)),
    });
  }
  for (const lookup of message.addressTableLookups) {
    const lookupTableAccount = addressLookupTableAccounts.get(lookup.accountKey.toBase58());
    if (!lookupTableAccount) {
      throw new Error(`Address lookup table account ${lookup.accountKey.toBase58()} not found`);
    }

    for (const accountIndex of lookup.writableIndexes) {
      const pubkey: PublicKey = lookupTableAccount.state.addresses[accountIndex];
      if (!pubkey) {
        throw new Error(
          `Address lookup table account ${lookup.accountKey.toBase58()} does not contain address at index ${accountIndex}`,
        );
      }
      accountMetas.push({
        pubkey,
        isWritable: true,
        isSigner: false,
      });
    }
    for (const accountIndex of lookup.readonlyIndexes) {
      const pubkey: PublicKey = lookupTableAccount.state.addresses[accountIndex];
      if (!pubkey) {
        throw new Error(
          `Address lookup table account ${lookup.accountKey.toBase58()} does not contain address at index ${accountIndex}`,
        );
      }
      accountMetas.push({
        pubkey,
        isWritable: false,
        isSigner: false,
      });
    }
  }

  return {
    accountMetas,
    lookupTableAccounts: [...addressLookupTableAccounts.values()],
  };
}

export function transactionMessageToVaultMessage({
  message,
  addressLookupTableAccounts,
  vaultPda,
}: TransactionMessageToVaultMessageArgs): multisig.types.TransactionMessage {
  const compiledMessageBytes = multisig.utils.transactionMessageToMultisigTransactionMessageBytes({
    message: message,
    addressLookupTableAccounts,
    vaultPda,
  });

  const [compiledMessage] = multisig.types.transactionMessageBeet.deserialize(
    Buffer.from(compiledMessageBytes),
  );

  return compiledMessage;
}

export function isSignerIndex(message: multisig.types.TransactionMessage, index: number): boolean {
  return index < message.numSigners;
}

export function isStaticWritableIndex(
  message: multisig.types.TransactionMessage,
  index: number,
): boolean {
  const numAccountKeys = message.accountKeys.length;
  const { numSigners, numWritableSigners, numWritableNonSigners } = message;

  if (index >= numAccountKeys) {
    return false;
  }

  if (index < numWritableSigners) {
    return true;
  }

  if (index >= numSigners) {
    const indexIntoNonSigners = index - numSigners;
    return indexIntoNonSigners < numWritableNonSigners;
  }

  return false;
}
