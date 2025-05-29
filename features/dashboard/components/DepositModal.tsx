// components/features/dashboard/components/DepositModal.tsx
import { useState, useEffect } from 'react';
import { useSolanaWallets } from '@privy-io/react-auth/solana';
import { PublicKey } from '@solana/web3.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import { multisigService } from '@/services/blockchain/multisig';
import Spinner from '@/components/common/Spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOrganizations } from '@/hooks/useOrganizations';
import axios from 'axios';
import { TokenBalance, TokenType } from '@/types/token';
import { useQuery } from '@tanstack/react-query';
import { PaymentMethod } from '@/types/ramping';

interface DepositModalProps {
  tokenBalances: TokenBalance[];
}

// Define the allowed stablecoin types for deposits
type StablecoinType = Exclude<TokenType, 'SOL'>;

export function DepositModal({ tokenBalances }: DepositModalProps) {
  const { wallets, ready } = useSolanaWallets();
  const { organization } = useOrganizations();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedToken, setSelectedToken] = useState<StablecoinType>('USDC');
  const [amount, setAmount] = useState<string>('');
  const [step, setStep] = useState<'form' | 'confirmation' | 'processing'>('form');
  const [simulationData, setSimulationData] = useState<any>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');

  // Get the Privy-embedded wallet
  const embeddedWallet = wallets.find((wallet) => wallet.walletClientType === 'privy');
  const publicKey = embeddedWallet?.address ? new PublicKey(embeddedWallet.address) : null;

  // Use React Query to fetch payment methods
  const {
    data: paymentMethodsResponse,
    isLoading: isLoadingPaymentMethods,
    refetch: refetchPaymentMethods,
  } = useQuery({
    queryKey: ['paymentMethods', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return { bankAccounts: [] };
      const response = await axios.get(`/api/organizations/${organization.id}/payment-methods`);
      return response.data.success ? response.data.data : { bankAccounts: [] };
    },
    enabled: !!organization?.id && isOpen,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });

  const paymentMethods: PaymentMethod[] = paymentMethodsResponse?.bankAccounts || [];

  // Set the first payment method as selected if available
  useEffect(() => {
    if (paymentMethods.length > 0 && !selectedPaymentMethod) {
      setSelectedPaymentMethod(paymentMethods[0].id);
    }
  }, [paymentMethods, selectedPaymentMethod]);

  // Modal open handler
  const handleOpenModal = () => {
    setIsOpen(true);

    if (organization?.id) {
      refetchPaymentMethods();
    }
  };

  const handleSimulateTransfer = async () => {
    if (!publicKey || !organization?.id || !selectedPaymentMethod) {
      toast.error('Missing required information');
      return;
    }

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);
    try {
      // Ensure vault and ATA are set up for the selected stablecoin
      const vaultResult = await multisigService.ensureVaultTokenAccount(publicKey, selectedToken);

      if (!vaultResult.success || !vaultResult.ata) {
        throw new Error(vaultResult.error || 'Failed to initialize vault');
      }

      // Now simulate the transfer via Zynk
      const response = await axios.post('/api/ramp/onramp/simulate', {
        organizationId: organization.id,
        amount: amountValue,
        token: selectedToken,
        paymentMethodId: selectedPaymentMethod,
        destinationAddress: vaultResult.ata.toBase58(),
      });

      if (response.data.success) {
        setSimulationData(response.data.data);
        setStep('confirmation');
      } else {
        throw new Error(response.data.error?.message || 'Simulation failed');
      }
    } catch (error) {
      console.error('Error simulating transfer:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to simulate transfer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteTransfer = async () => {
    if (!simulationData || !organization?.id) {
      toast.error('Missing simulation data');
      return;
    }

    setIsSubmitting(true);
    setStep('processing');

    try {
      const response = await axios.post('/api/ramp/onramp/execute', {
        organizationId: organization.id,
        simulationId: simulationData.executionId,
      });

      if (response.data.success) {
        toast.success('Deposit initiated successfully!');
        setIsOpen(false);
        // Reset the form
        setAmount('');
        setSelectedToken('USDC');
        setStep('form');
        setSimulationData(null);
      } else {
        throw new Error(response.data.error?.message || 'Execution failed');
      }
    } catch (error) {
      console.error('Error executing transfer:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to execute transfer');
      setStep('confirmation'); // Go back to confirmation step on error
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setAmount('');
    setSelectedToken('USDC');
    setStep('form');
    setSimulationData(null);
  };

  // Check if business is verified
  const isBusinessVerified = !!(
    organization &&
    organization.last_verified_at !== null &&
    organization.verification_status === 'verified'
  );

  // Check if wallet is ready and connected
  const isWalletReady = ready && !!embeddedWallet?.address;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setIsOpen(false);
          resetForm();
        }
        setIsOpen(open);
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="p-0 font-medium text-black hover:bg-transparent hover:text-gray-600 mr-[4px]"
          onClick={(e) => {
            if (!isBusinessVerified) {
              e.preventDefault();
              e.stopPropagation();
              toast.error('Please complete business verification', {
                duration: 3000,
                position: 'top-center',
                icon: '🔒',
              });
              return;
            } else if (!isWalletReady) {
              e.preventDefault();
              e.stopPropagation();
              toast.error('Wallet not connected', {
                duration: 3000,
                position: 'top-center',
              });
              return;
            } else {
              handleOpenModal();
            }
          }}
        >
          Deposit +
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-md"
        onPointerDownOutside={(e) => {
          if (isSubmitting) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (isSubmitting) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Deposit Funds</DialogTitle>
          <DialogDescription>
            Fund your business wallet with stablecoins using your linked bank account.
          </DialogDescription>
        </DialogHeader>

        {step === 'form' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Stablecoin</Label>
              <Select
                value={selectedToken}
                onValueChange={(value: StablecoinType) => setSelectedToken(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a stablecoin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USDC">USDC - US Dollar Coin</SelectItem>
                  <SelectItem value="USDT">USDT - Tether USD</SelectItem>
                  <SelectItem value="EURC">EURC - Euro Coin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                min="1"
                step="0.01"
                placeholder={`Enter amount in ${selectedToken}`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              {isLoadingPaymentMethods ? (
                <div className="flex items-center justify-center h-10">
                  <Spinner className="h-4 w-4" />
                </div>
              ) : paymentMethods.length === 0 ? (
                <div className="text-sm text-red-500">
                  No payment methods available. Please add a bank account in settings.
                </div>
              ) : (
                <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((method) => (
                      <SelectItem key={method.id} value={method.id}>
                        {method.bank_name}{' '}
                        {method.masked_account_number ? `- ${method.masked_account_number}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
              <p>
                This will deposit {selectedToken} to your business wallet using your linked payment
                method
              </p>
            </div>

            <Button
              onClick={handleSimulateTransfer}
              className="w-full"
              disabled={
                isSubmitting ||
                !isWalletReady ||
                !amount ||
                paymentMethods.length === 0 ||
                !selectedPaymentMethod
              }
            >
              {isSubmitting ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  Processing...
                </>
              ) : (
                'Continue'
              )}
            </Button>
          </div>
        )}

        {step === 'confirmation' && simulationData && (
          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <h3 className="font-medium mb-2">Transaction Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount:</span>
                  <span className="font-medium">
                    {simulationData.amount} {selectedToken}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Fee:</span>
                  <span className="font-medium">
                    {simulationData.fee} {selectedToken}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">You Receive:</span>
                  <span className="font-medium">
                    {simulationData.netAmount} {selectedToken}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Estimated Processing Time:</span>
                  <span className="font-medium">Instant*</span>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-500">
                * Funds will be available immediately in your wallet. Bank settlement will occur in
                1-3 business days.
              </div>
            </div>

            <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
              <p>
                By proceeding, you authorize {simulationData.providerName} to debit your account for
                the amount specified above.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep('form')}
                disabled={isSubmitting}
                className="flex-1"
              >
                Back
              </Button>
              <Button onClick={handleExecuteTransfer} disabled={isSubmitting} className="flex-1">
                {isSubmitting ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2" />
                    Processing...
                  </>
                ) : (
                  'Confirm Deposit'
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="py-8 text-center space-y-4">
            <Spinner className="h-8 w-8 mx-auto" />
            <p className="text-sm">Processing your deposit...</p>
            <p className="text-xs text-gray-500">Please do not close this window.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
