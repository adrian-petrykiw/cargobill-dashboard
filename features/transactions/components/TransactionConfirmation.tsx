// features/transactions/components/TransactionConfirmation.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import { toast } from 'react-hot-toast';
import { Organization } from '@/schemas/organization.schema';
import { TransactionStatus } from './TransactionStatus';
import { createCipheriv, createHash, randomBytes } from 'crypto';
import { ConnectedSolanaWallet } from '@privy-io/react-auth/solana';
import { TOKENS, USDC_MINT } from '@/constants/solana';
import { EnrichedVendorFormValues, Invoice } from '@/schemas/vendor.schema';
import { PaymentDetailsFormValues } from '@/schemas/vendor.schema';
import { formatPaymentMethodDisplay } from '@/schemas/payment-method.schema';
import { transactionApi } from '@/services/api/transactionApi';
import { mapPaymentMethodToDbValue } from '@/lib/formatters/transactionMappers';
import { paymentService } from '@/services/api/paymentApi';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { CalendarIcon } from 'lucide-react';

interface TransactionConfirmationProps {
  onClose: () => Promise<void>;
  onBack: () => void;
  vendorData: EnrichedVendorFormValues;
  paymentData: PaymentDetailsFormValues & { onrampFee: number };
  wallet: ConnectedSolanaWallet | undefined;
  organization: Organization | null;
  onTransactionStatusChange: (isProcessing: boolean) => void;
}

type StatusType = 'initial' | 'encrypting' | 'creating' | 'confirming' | 'confirmed';

export function TransactionConfirmation({
  onClose,
  onBack,
  vendorData,
  paymentData,
  wallet,
  organization,
  onTransactionStatusChange,
}: TransactionConfirmationProps) {
  const [status, setStatus] = useState<StatusType>('initial');
  const [isProcessing, setIsProcessing] = useState(false);

  // Check if payment method requires onramp (not business wallet/available credit)
  // Based on transactionMappers.ts: account_credit maps to operational_wallet (business wallet)
  const requiresOnramp = paymentData.paymentMethod !== 'account_credit';

  // Calculate totals using onramp fee from payment data
  const subtotal = vendorData.totalAmount || 0;
  const transactionFee = 15;
  const onrampFeeAmount = paymentData.onrampFee || 0;
  const total = subtotal + transactionFee + onrampFeeAmount;

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
      onTransactionStatusChange(true);
      setStatus('encrypting');

      console.log('🔒 Starting secure payment transaction flow');

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

      setStatus('creating');

      // Fetch vendor details
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

      // Extract custom fields from vendor data
      const customFields = extractCustomFields(vendorData);
      console.log('Custom fields extracted:', customFields);

      // Convert frontend payment method to database payment_method value
      const dbPaymentMethod = mapPaymentMethodToDbValue(paymentData.paymentMethod);
      console.log('Payment method mapping:', {
        frontend: paymentData.paymentMethod,
        database: dbPaymentMethod,
      });

      // Calculate total transaction fee (paid once for all invoices)
      const transactionFeeAmount = Math.round(15 * 1e6); // $15 fee in token units
      let feeCollected = false;

      setStatus('confirming');

      // Process each invoice using the secure backend flow
      for (const [invoiceIndex, invoice] of (vendorData.invoices as Invoice[]).entries()) {
        console.log(
          `🔄 Processing invoice ${invoiceIndex + 1}/${vendorData.invoices.length}: ${invoice.number}`,
        );

        // Process and hash files if present (for memo and database storage)
        if (invoice.files && invoice.files.length > 0) {
          const hashPromises = invoice.files.map((file) => hashFile(file));
          fileHashes[invoice.number] = await Promise.all(hashPromises);
          console.log(
            `Generated ${fileHashes[invoice.number].length} file hashes for invoice ${invoice.number}`,
          );
        }

        // Create ESSENTIAL invoice data for memo with consistent structure
        const essentialInvoiceData = {
          invoice: {
            number: invoice.number,
            amount: invoice.amount,
            fileHashes: fileHashes[invoice.number] || [],
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
          receiverMultisigAddress: vendorApiData.multisigAddress,
          invoiceIndex: invoiceIndex,
          totalInvoices: vendorData.invoices.length,
          feeCollectedWithThisInvoice: !feeCollected,
          onrampFee: paymentData.onrampFee,
        };

        // Create deterministic hash for memo
        const memoDataHash = createHash('sha256')
          .update(JSON.stringify(essentialInvoiceData, Object.keys(essentialInvoiceData).sort()))
          .digest('hex');

        memoHashes[invoice.number] = memoDataHash;

        // Encrypt comprehensive data for database storage
        const { encrypted: dbEncryptedData, key: dbEncryptionKey } =
          encryptPaymentData(comprehensiveInvoiceData);

        encryptionKeys[invoice.number] = dbEncryptionKey;

        // Create memo data
        const memoData = {
          h: memoDataHash,
          v: '1.0',
          i: invoice.number,
          f: !feeCollected ? transactionFeeAmount : 0, // Include fee amount in memo for first invoice
        };

        const memoString = JSON.stringify(memoData);
        console.log('Memo data structure:', memoString);

        console.log('🔒 Creating secure payment transaction...');

        try {
          // Step 1: Create transactions on backend with secure server wallet as fee payer
          const createResponse = await paymentService.createPaymentTransaction({
            organizationId: organization.id,
            invoice: {
              number: invoice.number,
              amount: invoice.amount,
              index: invoiceIndex,
              totalInvoices: vendorData.invoices.length,
            },
            tokenType: paymentData.tokenType as 'USDC' | 'USDT' | 'EURC',
            vendorMultisigAddress: vendorApiData.multisigAddress,
            transferMessage: {
              payerKey: '', // Not used in backend, will be set to vault PDA
              recentBlockhash: '',
              instructions: [],
            },
            memo: memoString,
            includeTransactionFee: !feeCollected,
          });

          console.log('✅ Backend created transactions:', {
            transactionIndex: createResponse.transactionIndex,
            multisigAddress: createResponse.multisigAddress,
            vaultAddress: createResponse.vaultAddress,
          });

          // Step 2: User signs CREATE transaction
          console.log('👤 User signing CREATE transaction...');
          const createTxBuffer = Buffer.from(createResponse.createTransaction, 'base64');
          const createTx = VersionedTransaction.deserialize(createTxBuffer);
          const signedCreateTx = await wallet.signTransaction(createTx);

          // Step 3: Submit CREATE transaction to backend for server wallet signing
          console.log('📤 Submitting CREATE transaction to backend...');
          const createResult = await paymentService.submitSignedTransaction({
            serializedTransaction: Buffer.from(signedCreateTx.serialize()).toString('base64'),
            expectedFeeAmount: 15,
            tokenMint: tokenMint.toString(),
            organizationId: organization.id,
            feeCollectionSignature: 'integrated-in-main-transaction',
          });

          console.log('✅ CREATE transaction completed:', createResult.signature);

          // Wait before next transaction
          await new Promise((resolve) => setTimeout(resolve, 3000));

          // Step 4: User signs PROPOSE + APPROVE transaction
          console.log('👤 User signing PROPOSE + APPROVE transaction...');
          const proposeTxBuffer = Buffer.from(createResponse.proposeTransaction, 'base64');
          const proposeTx = VersionedTransaction.deserialize(proposeTxBuffer);
          const signedProposeTx = await wallet.signTransaction(proposeTx);

          // Step 5: Submit PROPOSE + APPROVE transaction to backend
          console.log('📤 Submitting PROPOSE + APPROVE transaction to backend...');
          const proposeResult = await paymentService.submitSignedTransaction({
            serializedTransaction: Buffer.from(signedProposeTx.serialize()).toString('base64'),
            expectedFeeAmount: 15,
            tokenMint: tokenMint.toString(),
            organizationId: organization.id,
            feeCollectionSignature: 'integrated-in-main-transaction',
          });

          console.log('✅ PROPOSE + APPROVE transaction completed:', proposeResult.signature);

          // Wait before execution
          await new Promise((resolve) => setTimeout(resolve, 3000));

          // Step 6: User signs EXECUTE transaction
          console.log('👤 User signing EXECUTE transaction...');
          const executeTxBuffer = Buffer.from(createResponse.executeTransaction, 'base64');
          const executeTx = VersionedTransaction.deserialize(executeTxBuffer);
          const signedExecuteTx = await wallet.signTransaction(executeTx);

          // Step 7: Submit EXECUTE transaction to backend
          console.log('📤 Submitting EXECUTE transaction to backend...');
          const executeResult = await paymentService.submitSignedTransaction({
            serializedTransaction: Buffer.from(signedExecuteTx.serialize()).toString('base64'),
            expectedFeeAmount: 15,
            tokenMint: tokenMint.toString(),
            organizationId: organization.id,
            feeCollectionSignature: 'integrated-in-main-transaction',
          });

          console.log('✅ EXECUTE transaction completed:', executeResult.signature);

          // Mark fee as collected after first invoice
          if (!feeCollected) {
            feeCollected = true;
          }

          // Store comprehensive transaction data in database
          const transactionData = {
            organization_id: organization.id,
            signature: executeResult.signature,
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
            payment_method: dbPaymentMethod,
            sender: {
              multisig_address: multisigAddress.toString(),
              vault_address: createResponse.vaultAddress,
              wallet_address: wallet.address,
            },
            recipient: {
              multisig_address: vendorApiData.multisigAddress,
              vault_address: '', // Will be calculated by backend
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
              fee_collection_approach: 'integrated_in_main_transaction',
              fee_amount: invoiceIndex === 0 ? transactionFeeAmount : 0,
              onramp_fee: paymentData.onrampFee,
              secure_backend_flow: true,
              invoice_index: invoiceIndex,
              total_invoices: vendorData.invoices.length,
              data_structure_consistency: {
                fileHashes_always_present: true,
                essential_fields_count: Object.keys(essentialInvoiceData.invoice).length,
                comprehensive_fields_count: Object.keys(comprehensiveInvoiceData).length,
              },
              payment_method_details: {
                frontend_selection: paymentData.paymentMethod,
                database_value: dbPaymentMethod,
                requires_onramp: requiresOnramp,
                ...((paymentData.paymentMethod === 'ach' ||
                  paymentData.paymentMethod === 'wire') && {
                  account_details: {
                    account_name: paymentData.accountName,
                    account_type: paymentData.accountType,
                    bank_name: paymentData.bankName,
                    swift_code: paymentData.swiftCode,
                  },
                }),
                ...((paymentData.paymentMethod === 'credit_card' ||
                  paymentData.paymentMethod === 'debit_card') && {
                  card_details: {
                    billing_name: paymentData.billingName,
                    billing_address: {
                      address: paymentData.billingAddress,
                      city: paymentData.billingCity,
                      state: paymentData.billingState,
                      zip: paymentData.billingZip,
                    },
                  },
                }),
              },
            },
            recipient_organization_id: recipientOrganizationId,
            recipient_name: recipientName,
          };

          // Store the transaction using the transaction API service
          console.log('💾 Storing transaction with secure backend flow:', {
            senderOrgId: organization.id,
            recipientOrgId: recipientOrganizationId,
            signature: executeResult.signature,
            amount: invoice.amount,
            paymentMethod: dbPaymentMethod,
            feeCollectedWithThisInvoice: invoiceIndex === 0,
            onrampFee: paymentData.onrampFee,
            secureBackendFlow: true,
          });

          await transactionApi.storeTransaction(transactionData);

          console.log('✅ Transaction stored successfully with secure backend flow');
        } catch (invoiceError) {
          console.error(`❌ Error processing invoice ${invoice.number}:`, invoiceError);
          throw invoiceError;
        }
      }

      // Set status to confirmed after processing all invoices
      setStatus('confirmed');
      console.log('🎉 All transactions completed successfully using secure backend flow');
    } catch (error) {
      console.error('❌ Transaction failed:', error);
      toast.error(error instanceof Error ? error.message : 'Transaction failed');
      setStatus('initial');
      onTransactionStatusChange(false);
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
        <div className="space-y-4">
          <h2 className="text-lg font-semibold mb-4">Payment Details</h2>
          {/* <div className="grid grid-cols-2 gap-4 pb-3">
            <div>
              <div className="flex justify-start gap-2">
                <p className="font-medium text-sm">Payment Date:</p>
                <span className="text-gray-600">
                  <p className="text-sm">{vendorData.paymentDate.toLocaleDateString()}</p>{' '}
                </span>
              </div>
            </div>
            <div className="flex flex-col">
              <p className="font-medium text-sm pb-2">Receiver</p>
              <Card className="bg-white rounded-sm p-0 w-[100%]">
                <CardContent className="px-4 py-2">
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
              </Card>{' '}
            </div>
          </div> */}

          <div className="px-0">
            <div className="flex justify-between items-start gap-4">
              <div className="flex flex-col w-[45%] gap-2">
                <div className="text-sm flex">
                  <p className="font-medium text-gray-900">Receiver</p>{' '}
                </div>
                <div className="text-sm flex w-[100%]">
                  <Card className="bg-white rounded-sm p-0 w-[100%]">
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
                  </Card>{' '}
                </div>
              </div>

              <div className="flex flex-col w-[50%] gap-2">
                <p className="font-medium text-sm">Invoices</p>

                {/* Invoice Table */}
                <div className="bg-transparent overflow-hidden">
                  {/* Header */}
                  <div className="bg-transparent pr-4 pb-2">
                    <div className="grid grid-cols-12 gap-4 text-xs font-normal text-gray-600">
                      <div className="col-span-3">Invoice #</div>
                      <div className="col-span-6 ml-3">Attachment(s)</div>
                      <div className="col-span-3 text-right">Amount</div>
                    </div>
                  </div>

                  {/* Invoice Rows */}
                  {vendorData?.invoices.map((invoice: Invoice, index: number) => (
                    <div
                      rounded-sm
                      p-0
                      key={index}
                      className="bg-white rounded-sm border-gray-200 shadow-sm border mb-2  px-4 py-3"
                    >
                      <div className="grid grid-cols-12 gap-4 text-xs">
                        {/* Invoice Number */}
                        <div className="col-span-3 font-medium text-gray-900">{invoice.number}</div>

                        {/* Files */}
                        <div className="col-span-6">
                          {invoice.files && invoice.files.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {invoice.files.map((file, fileIndex) => (
                                <span
                                  key={fileIndex}
                                  className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-500 cursor-pointer text-xs"
                                >
                                  {file.name}
                                  <svg
                                    className="w-3 h-3"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                    />
                                  </svg>
                                  {fileIndex < (invoice.files?.length || 0) - 1 && (
                                    <span className="text-gray-400">,</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </div>

                        {/* Amount */}
                        <div className="col-span-3 text-right font-semibold text-gray-900 text-xs">
                          {invoice.amount.toFixed(2)} {paymentData.tokenType}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Dynamic Custom Fields Display */}
                  {Object.entries(extractCustomFields(vendorData)).length > 0 && (
                    <div className="grid grid-cols-2 gap-4">
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
                    </div>
                  )}

                  {/* Additional Info */}
                  {vendorData.additionalInfo && (
                    <div>
                      <p className="font-medium text-sm mb-2">Additional Notes</p>
                      <p className="text-sm text-muted-foreground">{vendorData.additionalInfo}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* <div className="flex flex-col w-[50%] gap-2 justify-start items-end">
                <p className="text-sm font-medium">Payment Date</p>

                <div className="relative w-[25%]">
                  <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />

                  <div className=" text-right w-full px-3 py-2 text-sm border border-slate-300 rounded-sm bg-slate-100 text-slate-400 cursor-not-allowed shadow-sm">
                    {vendorData.paymentDate.toISOString().split('T')[0]}
                  </div>
                </div>

                <span className="text-gray-600">
                  <p className="text-sm">{vendorData.paymentDate.toLocaleDateString()}</p>{' '}
                </span>
              </div> */}
            </div>
          </div>

          {/* Summary Section */}
          {/* <div className="pt-3">
            <p className="font-medium text-sm">Invoices</p>

            <div className="bg-transparent overflow-hidden">
              <div className="bg-transparent pr-4 py-2">
                <div className="grid grid-cols-12 gap-4 text-xs font-normal text-gray-600">
                  <div className="col-span-3">Invoice #</div>
                  <div className="col-span-6 ml-3">Attached File(s)</div>
                  <div className="col-span-3 text-right">Amount</div>
                </div>
              </div>

              {vendorData?.invoices.map((invoice: Invoice, index: number) => (
                <div
                  rounded-sm
                  p-0
                  key={index}
                  className="bg-white rounded-sm border-gray-200 shadow-sm border mb-2  px-4 py-3"
                >
                  <div className="grid grid-cols-12 gap-4 text-xs">
                    <div className="col-span-3 font-medium text-gray-900">{invoice.number}</div>

                    <div className="col-span-6">
                      {invoice.files && invoice.files.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {invoice.files.map((file, fileIndex) => (
                            <span
                              key={fileIndex}
                              className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-500 cursor-pointer text-xs"
                            >
                              {file.name}
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                              {fileIndex < (invoice.files?.length || 0) - 1 && (
                                <span className="text-gray-400">,</span>
                              )}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </div>

                    <div className="col-span-3 text-right font-semibold text-gray-900 text-xs">
                      {invoice.amount.toFixed(2)} {paymentData.tokenType}
                    </div>
                  </div>
                </div>
              ))}

              {Object.entries(extractCustomFields(vendorData)).length > 0 && (
                <div className="grid grid-cols-2 gap-4">
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
                </div>
              )}

              {vendorData.additionalInfo && (
                <div>
                  <p className="font-medium text-sm mb-2">Additional Notes</p>
                  <p className="text-sm text-muted-foreground">{vendorData.additionalInfo}</p>
                </div>
              )}
            </div>
          </div> */}
        </div>

        {/* Summary Rows */}
        <div className="p-0 m-0">
          {/* Subtotal */}
          <div className="px-0 pb-1 gap-2 flex justify-between items-center">
            <span className="text-xs  text-slate-500">Subtotal</span>
            <span className="text-xs   text-slate-500">
              {subtotal.toFixed(2)} {paymentData.tokenType}
            </span>
          </div>

          {/* Transaction Fee */}
          <div className="px-0 py-1 gap-2 flex justify-between items-center">
            <span className="text-xs text-slate-500">Transaction Fee</span>
            <span className="text-xs text-slate-500">
              {transactionFee.toFixed(2)} {paymentData.tokenType}
            </span>
          </div>

          {/* Instant Onramp Fee - Only show if payment method requires onramp */}
          {requiresOnramp && onrampFeeAmount > 0 && (
            <div className="px-0 py-1 gap-2 flex justify-between items-center">
              <span className="text-xs text-slate-500">Instant Onramp Fee</span>
              <span className="text-xs  text-slate-500">
                {onrampFeeAmount.toFixed(2)} {paymentData.tokenType}
              </span>
            </div>
          )}
          {/* Total */}
          <div className="px-0 pt-1">
            <div className="flex justify-between items-center">
              <div className="text-sm ">
                <span className="font-medium text-gray-900">Total {'    '}</span>
              </div>
              <div className="text-sm">
                <div>
                  <span className="font-medium text-gray-900">
                    {total.toFixed(2)} {'    '}
                    {paymentData.tokenType}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-0 py-3 border-y">
          <div className="flex justify-between items-center">
            <div className="text-sm flex flex-col gap-2">
              <span className="font-medium text-gray-900">Payment Method</span>{' '}
              <span className="text-gray-600">
                <p className="text-sm">
                  {' '}
                  {formatPaymentMethodDisplay(paymentData.paymentMethod)}
                </p>{' '}
              </span>
            </div>

            <div className="flex flex-col gap-2 justify-start items-end">
              <p className="text-sm font-medium">Payment Date</p>

              {/* <div className="relative w-[25%]">
                  <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />

                  <div className=" text-right w-full px-3 py-2 text-sm border border-slate-300 rounded-sm bg-slate-100 text-slate-400 cursor-not-allowed shadow-sm">
                    {vendorData.paymentDate.toISOString().split('T')[0]}
                  </div>
                </div> */}

              <span className="text-gray-600">
                <p className="text-sm">{vendorData.paymentDate.toLocaleDateString()}</p>{' '}
              </span>
            </div>
            {/* <div className="text-sm">
              <span className="text-gray-600">
                {formatPaymentMethodDisplay(paymentData.paymentMethod)}
              </span>

              <div className="relative">
                <div className=" text-right w-full px-3 py-2 text-sm border border-slate-200 rounded-sm bg-white text-slate-900 cursor-not-allowed shadow-sm">
                  {formatPaymentMethodDisplay(paymentData.paymentMethod)}
                </div>
              </div>

             
            </div> */}
          </div>
        </div>

        <div className="rounded-sm bg-blue-50 p-4 text-sm text-blue-800 border-blue-100 border-[1px]">
          <p>
            By confirming this transaction, you authorize a payment of {subtotal.toFixed(2)}{' '}
            {paymentData.tokenType} to {vendorData.receiverDetails?.name || 'the vendor'} on{' '}
            {vendorData.paymentDate.toLocaleDateString()}.
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
            {isProcessing ? 'Processing...' : 'Confirm & Pay'}
          </Button>
        </div>
      </div>
    </div>
  );
}
