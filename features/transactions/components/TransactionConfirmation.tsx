// features/transactions/components/TransactionConfirmation.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PublicKey, Transaction } from '@solana/web3.js';
import { toast } from 'react-hot-toast';
import {
  getMultisigPda,
  getVaultPda,
  getTransactionPda,
  accounts,
  instructions,
  PROGRAM_ID,
} from '@sqds/multisig';
import { Organization } from '@/schemas/organization.schema';
import { TransactionStatus } from './TransactionStatus';
import { solanaService } from '@/services/blockchain/solana';
import { createCipheriv, createHash, randomBytes } from 'crypto';
import { getAssociatedTokenAddress, createTransferInstruction } from '@solana/spl-token';
import { ConnectedSolanaWallet } from '@privy-io/react-auth/solana';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  TOKENS,
  USDC_MINT,
} from '@/constants/solana';
import { EnrichedVendorFormValues } from '@/schemas/vendor.schema';
import { PaymentDetailsFormValues } from '@/schemas/vendor.schema';
import { formatPaymentMethod } from '@/lib/formatters/payment-method';
import { TransactionMessage } from '@solana/web3.js';
import {
  getAccountsForExecuteCore,
  transactionMessageToVaultMessage,
  vaultTransactionExecuteSync,
} from '@/lib/helpers/squadsUtils';
import { transactionApi } from '@/services/api/transactionApi';

// Clean interface for Invoice type
interface Invoice {
  number: string;
  amount: number;
  files?: File[];
}

interface TransactionConfirmationProps {
  onClose: () => void;
  onBack: () => void;
  vendorData: EnrichedVendorFormValues;
  paymentData: PaymentDetailsFormValues;
  wallet: ConnectedSolanaWallet | undefined;
  organization: Organization | null;
}

type StatusType = 'initial' | 'encrypting' | 'creating' | 'confirming' | 'confirmed';

export function TransactionConfirmation({
  onClose,
  onBack,
  vendorData,
  paymentData,
  wallet,
  organization,
}: TransactionConfirmationProps) {
  const [status, setStatus] = useState<StatusType>('initial');
  const [isProcessing, setIsProcessing] = useState(false);

  // Extract custom fields from vendor data
  const extractCustomFields = (vendorData: EnrichedVendorFormValues) => {
    const baseFields = new Set([
      'vendor',
      'invoices',
      'tokenType',
      'paymentDate',
      'additionalInfo',
      'totalAmount',
      'sender',
      'receiverDetails',
    ]);

    const customFields: Record<string, any> = {};

    Object.entries(vendorData).forEach(([key, value]) => {
      if (!baseFields.has(key) && value !== undefined && value !== null && value !== '') {
        customFields[key] = value;
      }
    });

    return customFields;
  };

  const handleConfirmTransaction = async () => {
    if (!wallet || !organization?.id) {
      toast.error('Wallet or organization details missing');
      return;
    }

    try {
      setIsProcessing(true);
      setStatus('encrypting');

      // Hash file function
      const hashFile = async (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async (e) => {
            try {
              const arrayBuffer = e.target?.result as ArrayBuffer;
              const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
              const hashArray = Array.from(new Uint8Array(hashBuffer));
              const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
              resolve(hashHex);
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = () => reject(new Error('Error reading file'));
          reader.readAsArrayBuffer(file);
        });
      };

      // Encrypt payment data for database storage
      const encryptPaymentData = (data: any) => {
        const key = randomBytes(32);
        const iv = randomBytes(16);
        const cipher = createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(
          JSON.stringify(data, Object.keys(data).sort()),
          'utf8',
          'hex',
        );
        encrypted += cipher.final('hex');
        return {
          encrypted: iv.toString('hex') + ':' + encrypted,
          key: key.toString('hex'),
        };
      };

      // Storage for encryption keys and hashes
      const encryptionKeys: Record<string, string> = {};
      const memoHashes: Record<string, string> = {};
      const fileHashes: Record<string, string[]> = {};

      // Get organization's multisig address
      if (!organization.operational_wallet?.address) {
        throw new Error('Organization does not have an operational wallet');
      }

      const multisigAddress = new PublicKey(organization.operational_wallet.address);
      console.log('Organization multisig:', multisigAddress.toString());

      // Get vault PDA
      const [vaultPda] = getVaultPda({
        multisigPda: multisigAddress,
        index: 0,
      });
      console.log('Vault PDA:', vaultPda.toString());

      // Get token mint based on paymentData.tokenType
      const tokenMint = new PublicKey(
        paymentData.tokenType === 'USDC'
          ? USDC_MINT.toString()
          : paymentData.tokenType === 'USDT'
            ? TOKENS.USDT.mint.toString()
            : paymentData.tokenType === 'EURC'
              ? TOKENS.EURC.mint.toString()
              : (() => {
                  console.error(`Invalid token type: ${paymentData.tokenType}`);
                  throw new Error(`Unsupported token type: ${paymentData.tokenType}`);
                })(),
      );

      // Get connection from solanaService
      const connection = solanaService.connection;

      // Get Multisig account info
      let senderMultisigInfo;
      try {
        senderMultisigInfo = await accounts.Multisig.fromAccountAddress(
          connection,
          multisigAddress,
        );
        console.log("Found sender's multisig:", {
          threshold: senderMultisigInfo.threshold.toString(),
          transactionIndex: senderMultisigInfo.transactionIndex.toString(),
        });
      } catch (err) {
        console.error("Failed to find sender's multisig account:", err);
        throw new Error("Sender's multisig account not found");
      }

      const vaultAta = await getAssociatedTokenAddress(
        tokenMint,
        vaultPda,
        true,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );
      console.log('Vault ATA:', vaultAta.toString());

      setStatus('creating');
      const vendorApiResponse = await fetch(`/api/vendors/${vendorData.vendor}`);
      if (!vendorApiResponse.ok) {
        throw new Error('Failed to fetch vendor payment details');
      }

      const vendorApiResult = await vendorApiResponse.json();
      if (!vendorApiResult.success || !vendorApiResult.data) {
        throw new Error(vendorApiResult.error?.message || 'Failed to fetch vendor details');
      }

      const vendorApiData = vendorApiResult.data;

      if (!vendorApiData.multisigAddress) {
        throw new Error('Vendor has no valid multisig address');
      }

      // Extract recipient organization ID from vendor data for proper transaction storage
      const recipientOrganizationId = vendorApiData.organizationId || vendorApiData.organization_id;
      const recipientName =
        vendorApiData.name || vendorApiData.organization_name || 'Unknown Vendor';

      console.log('Vendor organization details:', {
        organizationId: recipientOrganizationId,
        name: recipientName,
        multisigAddress: vendorApiData.multisigAddress,
      });

      const receiverMultisigPda = new PublicKey(vendorApiData.multisigAddress);
      const [receiverVaultPda] = getVaultPda({
        multisigPda: receiverMultisigPda,
        index: 0,
      });

      console.log('Receiver multisig:', receiverMultisigPda.toString());
      console.log('Receiver vault PDA:', receiverVaultPda.toString());

      const receiverAta = await getAssociatedTokenAddress(
        tokenMint,
        receiverVaultPda,
        true,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );
      console.log('Receiver ATA:', receiverAta.toString());

      // Extract custom fields from vendor data
      const customFields = extractCustomFields(vendorData);
      console.log('Custom fields extracted:', customFields);

      // Process each invoice with consistent data structure approach
      for (const invoice of vendorData.invoices as Invoice[]) {
        // Process and hash files if present (for memo and database storage)
        if (invoice.files && invoice.files.length > 0) {
          const hashPromises = invoice.files.map((file) => hashFile(file));
          fileHashes[invoice.number] = await Promise.all(hashPromises);
          console.log(
            `Generated ${fileHashes[invoice.number].length} file hashes for invoice ${invoice.number}`,
          );
        }

        // Create ESSENTIAL invoice data for memo with consistent structure
        // Always include fileHashes field for data consistency, even if empty
        const essentialInvoiceData = {
          invoice: {
            number: invoice.number,
            amount: invoice.amount,
            fileHashes: fileHashes[invoice.number] || [], // Always present for consistency
          },
        };

        // Create comprehensive invoice data for database storage (complete audit trail)
        const comprehensiveInvoiceData = {
          invoice: {
            number: invoice.number,
            amount: invoice.amount,
            fileHashes: fileHashes[invoice.number] || [],
          },
          vendor: vendorData.vendor,
          paymentMethod: paymentData.paymentMethod,
          tokenType: paymentData.tokenType,
          paymentDate: vendorData.paymentDate?.toISOString() || new Date().toISOString(),
          timestamp: Date.now(),
          additionalInfo: vendorData.additionalInfo || '',
          customFields: customFields,
          organizationId: organization.id,
          walletAddress: wallet.address,
          multisigAddress: multisigAddress.toString(),
          receiverMultisigAddress: receiverMultisigPda.toString(),
        };

        // Create deterministic hash for memo (fixed-length SHA256)
        // Sort keys to ensure consistent hashing regardless of object property order
        const memoDataHash = createHash('sha256')
          .update(JSON.stringify(essentialInvoiceData, Object.keys(essentialInvoiceData).sort()))
          .digest('hex');

        // Store the memo hash for reference
        memoHashes[invoice.number] = memoDataHash;

        // Encrypt comprehensive data for database storage
        const { encrypted: dbEncryptedData, key: dbEncryptionKey } =
          encryptPaymentData(comprehensiveInvoiceData);

        // Store database encryption key
        encryptionKeys[invoice.number] = dbEncryptionKey;

        // Create transaction instructions
        const transferAmount = Math.round(invoice.amount * 1e6);

        const transferIx = createTransferInstruction(
          vaultAta,
          receiverAta,
          vaultPda,
          BigInt(transferAmount),
        );

        // Create FIXED-LENGTH memo instruction (consistent size every time)
        // This structure produces predictable SHA256 hash lengths and minimal memo size
        const memoData = {
          h: memoDataHash, // Always exactly 64 hex characters (SHA256 output)
          v: '1.0', // Always exactly 5 characters (version identifier)
          i: invoice.number, // Invoice number (business identifier)
        };

        // Calculate and log exact memo size for verification and monitoring
        const memoString = JSON.stringify(memoData);
        console.log('Essential memo data structure:', memoString);
        console.log('Memo data size (characters):', memoString.length);
        console.log('Hash length verification (should be 64):', memoDataHash.length);
        console.log('Essential data used for hash generation:', essentialInvoiceData);
        console.log('FileHashes field consistency check:', {
          hasFiles: invoice.files?.length || 0,
          hashArrayLength: fileHashes[invoice.number]?.length || 0,
          alwaysPresent: 'fileHashes' in essentialInvoiceData.invoice,
        });

        const memoIx = {
          keys: [],
          programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
          data: Buffer.from(memoString),
        };

        // Get next transaction index
        const currentTransactionIndex = Number(senderMultisigInfo.transactionIndex);
        const newTransactionIndex = BigInt(currentTransactionIndex + 1);
        console.log('Using transaction index:', newTransactionIndex.toString());

        // Create transaction message for transfer
        const transferMessage = new TransactionMessage({
          payerKey: vaultPda,
          recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
          instructions: [transferIx, memoIx],
        });

        console.log('Compiling vault message...');
        const compiledMessage = transactionMessageToVaultMessage({
          message: transferMessage,
          addressLookupTableAccounts: [],
          vaultPda: vaultPda,
        });

        // Get transaction PDA for all operations
        const [transactionPda] = getTransactionPda({
          multisigPda: multisigAddress,
          index: newTransactionIndex,
        });

        // Build the create, propose, and approve instructions
        console.log('Creating transaction instructions...');
        const createIx = instructions.vaultTransactionCreate({
          multisigPda: multisigAddress,
          transactionIndex: newTransactionIndex,
          creator: new PublicKey(wallet.address),
          vaultIndex: 0,
          ephemeralSigners: 0,
          transactionMessage: transferMessage,
          memo: `TX-${invoice.number}`,
        });

        const proposeIx = instructions.proposalCreate({
          multisigPda: multisigAddress,
          transactionIndex: newTransactionIndex,
          creator: new PublicKey(wallet.address),
        });

        const approveIx = instructions.proposalApprove({
          multisigPda: multisigAddress,
          transactionIndex: newTransactionIndex,
          member: new PublicKey(wallet.address),
        });

        // Setup transactions
        setStatus('confirming');

        // Create the first transaction: Create
        const createTx = new Transaction();
        createTx.feePayer = new PublicKey(wallet.address);
        createTx.add(createIx);

        // Get recent blockhash for transaction
        const latestBlockhash = await connection.getLatestBlockhash('confirmed');
        createTx.recentBlockhash = latestBlockhash.blockhash;

        // Add priority fee to transaction
        const createTxWithFee = await solanaService.addPriorityFee(
          createTx,
          new PublicKey(wallet.address),
          false,
        );

        console.log('Signing create transaction...');
        const signedCreateTx = await wallet.signTransaction(createTxWithFee);

        const createBase64Transaction = signedCreateTx.serialize().toString('base64');
        console.log('Signed CREATE transaction (base64):', createBase64Transaction);

        console.log('Sending create transaction...');
        const createSignature = await connection.sendRawTransaction(signedCreateTx.serialize(), {
          skipPreflight: true,
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        });

        console.log('Create transaction sent with signature:', createSignature);

        // Wait for confirmation
        const createStatus = await solanaService.confirmTransactionWithRetry(
          createSignature,
          'confirmed',
          10,
          60000,
          connection,
        );

        if (!createStatus || createStatus.err) {
          throw new Error(
            `Create transaction failed: ${createStatus ? JSON.stringify(createStatus.err) : 'No status returned'}`,
          );
        }

        console.log('Create transaction confirmed. Waiting before next step...');
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // Create the second transaction: Propose + Approve
        const proposeTx = new Transaction();
        proposeTx.feePayer = new PublicKey(wallet.address);
        proposeTx.add(proposeIx, approveIx);

        // Get fresh blockhash
        const proposeBlockhash = await connection.getLatestBlockhash('confirmed');
        proposeTx.recentBlockhash = proposeBlockhash.blockhash;

        // Add priority fee
        const proposeTxWithFee = await solanaService.addPriorityFee(
          proposeTx,
          new PublicKey(wallet.address),
          false,
        );

        console.log('Signing propose+approve transaction...');
        const signedProposeTx = await wallet.signTransaction(proposeTxWithFee);

        const proposeBase64Transaction = signedProposeTx.serialize().toString('base64');
        console.log('Signed PROPOSE + APPROVE transaction (base64):', proposeBase64Transaction);

        console.log('Sending propose+approve transaction...');
        const proposeSignature = await connection.sendRawTransaction(signedProposeTx.serialize(), {
          skipPreflight: true,
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        });

        console.log('Propose+approve transaction sent with signature:', proposeSignature);

        // Wait for confirmation
        const proposeStatus = await solanaService.confirmTransactionWithRetry(
          proposeSignature,
          'confirmed',
          10,
          60000,
          connection,
        );

        if (!proposeStatus || proposeStatus.err) {
          throw new Error(
            `Propose+approve transaction failed: ${proposeStatus ? JSON.stringify(proposeStatus.err) : 'No status returned'}`,
          );
        }

        console.log('Propose+approve transaction confirmed. Waiting before execution...');
        await new Promise((resolve) => setTimeout(resolve, 5000));

        console.log('Recomputing execution accounts with fresh state...');
        // Create a fresh transfer message with current blockhash for execution
        const executionTransferMessage = new TransactionMessage({
          payerKey: vaultPda,
          recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
          instructions: [transferIx, memoIx],
        });

        const executionCompiledMessage = transactionMessageToVaultMessage({
          message: executionTransferMessage,
          addressLookupTableAccounts: [],
          vaultPda: vaultPda,
        });

        // Get fresh execution accounts
        const { accountMetas: freshAccountMetas } = await getAccountsForExecuteCore({
          connection: connection,
          multisigPda: multisigAddress,
          message: executionCompiledMessage,
          ephemeralSignerBumps: [0],
          vaultIndex: 0,
          transactionPda,
          programId: PROGRAM_ID,
        });

        // Create execute instruction with fresh account metas
        const { instruction: executeIx } = vaultTransactionExecuteSync({
          multisigPda: multisigAddress,
          transactionIndex: newTransactionIndex,
          member: new PublicKey(wallet.address),
          accountsForExecute: freshAccountMetas,
          programId: PROGRAM_ID,
        });

        // Create the execution transaction
        const executeTx = new Transaction();
        executeTx.feePayer = new PublicKey(wallet.address);
        executeTx.add(executeIx);

        // Get fresh blockhash
        const executeBlockhash = await connection.getLatestBlockhash('confirmed');
        executeTx.recentBlockhash = executeBlockhash.blockhash;

        // Add priority fee with standard compute units (should be sufficient with minimal memo)
        const executeTxWithFee = await solanaService.addPriorityFee(
          executeTx,
          new PublicKey(wallet.address),
          false,
        );

        console.log('Signing execute transaction...');
        const signedExecuteTx = await wallet.signTransaction(executeTxWithFee);

        const executeBase64Transaction = signedExecuteTx.serialize().toString('base64');
        console.log('Signed EXECUTE transaction (base64):', executeBase64Transaction);

        console.log('Sending execute transaction...');
        const executeSignature = await connection.sendRawTransaction(signedExecuteTx.serialize(), {
          skipPreflight: true,
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        });

        console.log('Execute transaction sent with signature:', executeSignature);

        // Wait for confirmation
        const executeStatus = await solanaService.confirmTransactionWithRetry(
          executeSignature,
          'confirmed',
          10,
          60000,
          connection,
        );

        if (!executeStatus || executeStatus.err) {
          throw new Error(
            `Execute transaction failed: ${executeStatus ? JSON.stringify(executeStatus.err) : 'No status returned'}`,
          );
        }

        console.log('Execute transaction confirmed.');

        // Store comprehensive transaction data in database
        const transactionData = {
          organization_id: organization.id,
          signature: executeSignature,
          token_mint: tokenMint.toString(),
          proof_data: {
            encryption_keys: {
              [invoice.number]: encryptionKeys[invoice.number],
            },
            memo_hashes: {
              [invoice.number]: memoHashes[invoice.number],
            },
            file_hashes: fileHashes,
            comprehensive_encrypted_data: {
              [invoice.number]: dbEncryptedData,
            },
            essential_data_used: {
              [invoice.number]: essentialInvoiceData,
            },
          },
          amount: invoice.amount,
          transaction_type: 'payment' as const,
          sender: {
            multisig_address: multisigAddress.toString(),
            vault_address: vaultPda.toString(),
            wallet_address: wallet.address,
          },
          recipient: {
            multisig_address: receiverMultisigPda.toString(),
            vault_address: receiverVaultPda.toString(),
          },
          invoices: [
            {
              number: invoice.number,
              amount: invoice.amount,
              file_count: invoice.files?.length || 0,
            },
          ],
          status: 'confirmed',
          restricted_payment_methods: [],
          metadata: {
            custom_fields: customFields,
            payment_date: vendorData.paymentDate?.toISOString() || new Date().toISOString(),
            additional_info: vendorData.additionalInfo || '',
            files_processed: fileHashes[invoice.number]?.length || 0,
            memo_approach: 'essential_sha256_hash_consistent_structure',
            memo_data_size: memoString.length,
            memo_hash_length: memoDataHash.length,
            data_structure_consistency: {
              fileHashes_always_present: true,
              essential_fields_count: Object.keys(essentialInvoiceData.invoice).length,
              comprehensive_fields_count: Object.keys(comprehensiveInvoiceData).length,
            },
          },
          // Include recipient organization information for proper database storage
          recipient_organization_id: recipientOrganizationId,
          recipient_name: recipientName,
        };

        // Store the transaction using the transaction API service
        console.log('Storing transaction with recipient organization mapping:', {
          senderOrgId: organization.id,
          recipientOrgId: recipientOrganizationId,
          signature: executeSignature,
          amount: invoice.amount,
        });

        await transactionApi.storeTransaction(transactionData);

        console.log('Transaction stored successfully with essential data structure approach.');
      }

      // Set status to confirmed after processing all invoices
      setStatus('confirmed');
    } catch (error) {
      console.error('Transaction failed:', error);
      toast.error(error instanceof Error ? error.message : 'Transaction failed');
      setStatus('initial');
    } finally {
      setIsProcessing(false);
    }
  };

  if (status !== 'initial') {
    return <TransactionStatus currentStatus={status} onDone={onClose} />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-4">
        <div className="space-y-4 pb-0">
          <h2 className="text-lg font-semibold">Vendor & Invoice Details</h2>
          <div className="grid grid-cols-2 gap-4">
            {/* Vendor Card */}
            <div className="flex flex-col">
              <p className="font-medium text-sm pb-2">Vendor</p>
              <Card className="bg-muted/50 rounded-md p-0">
                <CardContent className="p-4">
                  {!vendorData?.receiverDetails ? (
                    <div className="text-sm text-muted-foreground justify-center p-4 items-center text-center">
                      Vendor details not available
                    </div>
                  ) : (
                    <div className="p-0 m-0">
                      <h4 className="font-semibold text-sm">
                        {vendorData.receiverDetails?.name || 'Unknown Vendor'}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Address: {vendorData.receiverDetails?.primary_address || 'NA'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Phone: {vendorData.receiverDetails?.business_details?.phone || 'NA'}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Invoices */}
            <div>
              <div className="flex justify-between">
                <p className="font-medium text-sm mb-2">Invoices</p>
              </div>
              <div className="space-y-2">
                {vendorData?.invoices.map((invoice: Invoice, index: number) => (
                  <Card key={index} className="bg-muted/50 rounded-md">
                    <CardContent className="flex w-full justify-between items-center h-full m-0 px-4 py-2 text-xs">
                      <div className="flex items-center">
                        <p>#{invoice.number}</p>
                        {invoice.files && invoice.files.length > 0 && (
                          <span className="ml-2 text-xs text-blue-500">
                            ({invoice.files.length} file{invoice.files.length !== 1 ? 's' : ''})
                          </span>
                        )}
                      </div>
                      <p>
                        {invoice.amount} {paymentData.tokenType}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Dynamic Custom Fields Display */}
            {Object.entries(extractCustomFields(vendorData)).map(([key, value]) => {
              const formattedKey = key
                .replace(/([A-Z])/g, ' $1')
                .replace(/_/g, ' ')
                .replace(/^./, (str) => str.toUpperCase());

              return (
                <div key={key}>
                  <p className="font-medium text-xs mb-2">{formattedKey}</p>
                  <p className="text-xs text-muted-foreground">{String(value)}</p>
                </div>
              );
            })}

            {/* Payment Date */}
            {vendorData.paymentDate && (
              <div>
                <p className="font-medium text-xs mb-2">Payment Date</p>
                <p className="text-xs text-muted-foreground">
                  {vendorData.paymentDate.toLocaleDateString()}
                </p>
              </div>
            )}

            {/* Additional Info */}
            {vendorData.additionalInfo && (
              <div>
                <p className="font-medium text-xs mb-2">Additional Notes</p>
                <p className="text-xs text-muted-foreground">{vendorData.additionalInfo}</p>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Payment Details Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Payment Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-medium text-sm mb-2">Payment Method</p>
              <p className="text-sm text-muted-foreground">
                {formatPaymentMethod(paymentData.paymentMethod)}
              </p>
            </div>
            <div>
              <p className="font-medium text-sm mb-2 justify-end text-end w-full">Total Amount</p>
              <p className="text-sm text-muted-foreground justify-end text-end w-full">
                {vendorData.totalAmount?.toFixed(2)} {paymentData.tokenType}
              </p>
            </div>

            {/* Conditionally show payment method details */}
            {paymentData.paymentMethod === 'ach' && (
              <>
                <div>
                  <p className="font-medium text-sm">Account Name</p>
                  <p className="text-sm text-muted-foreground">{paymentData.accountName}</p>
                </div>
                <div>
                  <p className="font-medium text-sm">Account Type</p>
                  <p className="text-sm text-muted-foreground">{paymentData.accountType}</p>
                </div>
              </>
            )}

            {paymentData.paymentMethod === 'wire' && (
              <>
                <div>
                  <p className="font-medium text-sm">Bank Name</p>
                  <p className="text-sm text-muted-foreground">{paymentData.bankName}</p>
                </div>
                <div>
                  <p className="font-medium text-sm">Swift Code</p>
                  <p className="text-sm text-muted-foreground">
                    {paymentData.swiftCode || 'Not provided'}
                  </p>
                </div>
              </>
            )}

            {(paymentData.paymentMethod === 'credit_card' ||
              paymentData.paymentMethod === 'debit_card') && (
              <>
                <div>
                  <p className="font-medium text-sm">Card Holder</p>
                  <p className="text-sm text-muted-foreground">{paymentData.billingName}</p>
                </div>
                <div>
                  <p className="font-medium text-sm">Billing Address</p>
                  <p className="text-sm text-muted-foreground">
                    {paymentData.billingAddress}, {paymentData.billingCity},{' '}
                    {paymentData.billingState} {paymentData.billingZip}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800 border-blue-100 border-[1px]">
          <p>
            By confirming this transaction, you authorize the transfer of{' '}
            {vendorData.totalAmount?.toFixed(2)} {paymentData.tokenType} from your business wallet
            to {vendorData.receiverDetails?.name || 'the vendor'}.
          </p>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-background mt-auto">
        <div className="flex gap-4">
          <Button
            onClick={onBack}
            className="flex-1 bg-slate-300 hover:bg-slate-300 text-gray-700"
            variant="secondary"
            disabled={isProcessing}
          >
            Back
          </Button>
          <Button
            onClick={handleConfirmTransaction}
            className="flex-1"
            disabled={isProcessing || !wallet || !organization}
          >
            {isProcessing ? 'Processing...' : 'Confirm & Submit'}
          </Button>
        </div>
      </div>
    </div>
  );
}
