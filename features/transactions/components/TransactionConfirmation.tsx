// features/transactions/components/TransactionConfirmation.tsx
import { JSXElementConstructor, Key, ReactElement, ReactNode, ReactPortal, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { PublicKey, Transaction } from '@solana/web3.js';
import { toast } from 'react-hot-toast';
import { getMultisigPda, getVaultPda } from '@sqds/multisig';
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

  const handleConfirmTransaction = async () => {
    if (!wallet || !organization?.id) {
      toast.error('Wallet or organization details missing');
      return;
    }

    try {
      setIsProcessing(true);
      setStatus('encrypting');

      // Encrypt payment data for transaction memo
      const encryptPaymentData = (data: any) => {
        const key = randomBytes(32);
        const iv = randomBytes(16);
        const cipher = createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return {
          encrypted: iv.toString('hex') + ':' + encrypted,
          key: key.toString('hex'),
        };
      };

      // Storage for encryption keys and hashes
      const encryptionKeys: Record<string, string> = {};
      const paymentHashes: Record<string, string> = {};

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
            : TOKENS.SOL.mint.toString(),
      );

      const vaultAta = await getAssociatedTokenAddress(
        tokenMint,
        vaultPda,
        true,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );
      console.log('Vault ATA:', vaultAta.toString());

      // Fetch vendor details from API
      setStatus('creating');
      const vendorApiResponse = await fetch(`/api/vendors/${vendorData.vendor}/details`);
      if (!vendorApiResponse.ok) {
        throw new Error('Failed to fetch vendor payment details');
      }

      const vendorDetails = await vendorApiResponse.json();
      if (!vendorDetails.vaultAddress) {
        throw new Error('Vendor has no payment address');
      }

      const receiverVaultPda = new PublicKey(vendorDetails.vaultAddress);
      const receiverAta = await getAssociatedTokenAddress(
        tokenMint,
        receiverVaultPda,
        true,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );
      console.log('Receiver ATA:', receiverAta.toString());

      // Process each invoice
      for (const invoice of vendorData.invoices) {
        // Create and encrypt invoice data
        const invoiceData = {
          invoice: {
            number: invoice.number,
            amount: invoice.amount,
          },
          vendor: vendorData.vendor,
          paymentMethod: paymentData.paymentMethod,
          tokenType: paymentData.tokenType,
          timestamp: Date.now(),
          additionalInfo: vendorData.additionalInfo || '',
          relatedBolAwb: vendorData.relatedBolAwb || '',
        };

        const { encrypted: encryptedData, key: encryptionKey } = encryptPaymentData(invoiceData);
        encryptionKeys[invoice.number] = encryptionKey;
        paymentHashes[invoice.number] = createHash('sha256')
          .update(JSON.stringify(invoiceData))
          .digest('hex');

        // Create transaction instructions
        const transferAmount = Math.round(invoice.amount * 1e6); // Convert to micro-units for USDC

        // Create transfer instruction
        const transferIx = createTransferInstruction(
          vaultAta,
          receiverAta,
          vaultPda,
          BigInt(transferAmount),
        );

        // Create memo instruction with encrypted data
        const memoData = {
          d: encryptedData,
          h: paymentHashes[invoice.number],
          v: '1.0',
          i: invoice.number,
        };

        // Use Solana memo program
        const memoIx = {
          keys: [],
          programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
          data: Buffer.from(JSON.stringify(memoData)),
        };

        // Here we would typically create, propose, approve, and execute the transaction
        // using the Squads SDK, but for simplicity, we'll mock this process

        // Instead, we'll use our solanaService to simulate the transaction
        setStatus('confirming');

        // In a real implementation, we would:
        // 1. Create transaction with Squads SDK
        // 2. Add the transaction to the multisig
        // 3. Approve the transaction
        // 4. Execute the transaction

        // For now, we'll just simulate a wait
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Simulate storing the transaction data
        const transactionData = {
          organization_id: organization.id,
          signature: 'simulated_signature_' + Date.now(),
          token_mint: tokenMint.toString(),
          proof_data: {
            encryption_keys: {
              [invoice.number]: encryptionKeys[invoice.number],
            },
            payment_hashes: {
              [invoice.number]: paymentHashes[invoice.number],
            },
          },
          amount: invoice.amount,
          transaction_type: 'payment',
          sender: {
            multisig_address: multisigAddress.toString(),
            vault_address: vaultPda.toString(),
            wallet_address: wallet.address,
          },
          recipient: {
            multisig_address: vendorDetails.multisigAddress,
            vault_address: vendorDetails.vaultAddress,
          },
          invoices: [{ number: invoice.number, amount: invoice.amount }],
          status: 'confirmed',
          restricted_payment_methods: [],
          metadata: {},
        };

        // For a real implementation, store the transaction in your database
        console.log('Transaction data to store:', transactionData);
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
      <div className="flex-1 space-y-6">
        <div className="space-y-4 pb-4">
          <h2 className="text-lg font-semibold">Vendor & Invoice Details</h2>
          <div className="grid grid-cols-2 gap-4">
            {/* Vendor Card */}
            <div className="flex flex-col">
              <p className="font-medium text-sm pb-2">Vendor</p>
              <Card className="bg-muted/50 rounded-md">
                <CardContent className="p-4">
                  {!vendorData?.receiverDetails ? (
                    <div className="text-sm text-muted-foreground justify-center p-4 items-center text-center">
                      Vendor details not available
                    </div>
                  ) : (
                    <div className="p-0 m-0">
                      <h4 className="font-semibold text-sm">
                        {vendorData.receiverDetails?.business_details?.companyName}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {vendorData.receiverDetails?.business_details?.companyAddress}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {vendorData.receiverDetails?.business_details?.companyPhone}
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
                {vendorData?.invoices.map(
                  (
                    invoice: {
                      number:
                        | string
                        | number
                        | bigint
                        | boolean
                        | ReactElement<unknown, string | JSXElementConstructor<any>>
                        | Iterable<ReactNode>
                        | ReactPortal
                        | Promise<
                            | string
                            | number
                            | bigint
                            | boolean
                            | ReactPortal
                            | ReactElement<unknown, string | JSXElementConstructor<any>>
                            | Iterable<ReactNode>
                            | null
                            | undefined
                          >
                        | null
                        | undefined;
                      amount:
                        | string
                        | number
                        | bigint
                        | boolean
                        | ReactElement<unknown, string | JSXElementConstructor<any>>
                        | Iterable<ReactNode>
                        | ReactPortal
                        | Promise<
                            | string
                            | number
                            | bigint
                            | boolean
                            | ReactPortal
                            | ReactElement<unknown, string | JSXElementConstructor<any>>
                            | Iterable<ReactNode>
                            | null
                            | undefined
                          >
                        | null
                        | undefined;
                    },
                    index: Key | null | undefined,
                  ) => (
                    <Card key={index} className="bg-muted/50 rounded-md">
                      <CardContent className="flex w-full justify-between items-center h-full m-0 px-4 py-2 text-xs">
                        <p>#{invoice.number}</p>
                        <p>
                          {invoice.amount} {paymentData.tokenType}
                        </p>
                      </CardContent>
                    </Card>
                  ),
                )}
              </div>
            </div>

            {/* Dynamic Fields */}
            {Object.entries(vendorData || {})
              .filter(([key, value]) => {
                return !(
                  key === 'vendor' ||
                  key === 'invoices' ||
                  key === 'sender' ||
                  key === 'receiver' ||
                  key === 'amount' ||
                  key === 'tokenType' ||
                  key === 'receiverDetails' ||
                  key === 'totalAmount' ||
                  typeof value === 'object' ||
                  !value
                );
              })
              .map(([key, value]) => {
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

        <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
          <p>
            By confirming this transaction, you authorize the transfer of{' '}
            {vendorData.totalAmount?.toFixed(2)} {paymentData.tokenType} from your business wallet
            to {vendorData.receiverDetails?.business_details?.companyName || 'the vendor'}.
          </p>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-background mt-auto">
        <div className="flex gap-4">
          <Button
            onClick={onBack}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700"
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
