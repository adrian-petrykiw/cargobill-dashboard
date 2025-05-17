// components/features/dashboard/components/WithdrawModal.tsx
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

interface WithdrawModalProps {
  tokenBalances: TokenBalance[];
}

export function WithdrawModal({ tokenBalances }: WithdrawModalProps) {
  const { wallets, ready } = useSolanaWallets();
  const { organization } = useOrganizations();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenType>('USDC');
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

  // Update selected token based on available balances
  useEffect(() => {
    if (tokenBalances.length > 0) {
      // Select token with highest balance by default
      const highestBalanceToken = tokenBalances.reduce(
        (prev, current) => (current.balance > prev.balance ? current : prev),
        tokenBalances[0],
      );

      if (highestBalanceToken && highestBalanceToken.balance > 0) {
        setSelectedToken(highestBalanceToken.token);
      }
    }
  }, [tokenBalances]);

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

  const handleSimulateWithdrawal = async () => {
    if (!publicKey || !organization?.id || !selectedPaymentMethod) {
      toast.error('Missing required information');
      return;
    }

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const selectedBalance = tokenBalances.find((balance) => balance.token === selectedToken);
    if (!selectedBalance) {
      toast.error(`Token information not available`);
      return;
    }

    if (selectedBalance.balance < amountValue) {
      toast.error(`Insufficient ${selectedToken} balance`);
      return;
    }

    if (!selectedBalance.ata) {
      toast.error(`No ${selectedToken} token account found`);
      return;
    }

    setIsSubmitting(true);
    try {
      // Simulate the withdrawal via Zynk
      const response = await axios.post('/api/offramp/simulate', {
        organizationId: organization.id,
        amount: amountValue,
        token: selectedToken,
        paymentMethodId: selectedPaymentMethod,
        sourceAddress: selectedBalance.ata,
      });

      if (response.data.success) {
        setSimulationData(response.data.data);
        setStep('confirmation');
      } else {
        throw new Error(response.data.error?.message || 'Simulation failed');
      }
    } catch (error) {
      console.error('Error simulating withdrawal:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to simulate withdrawal');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteWithdrawal = async () => {
    if (!simulationData || !organization?.id) {
      toast.error('Missing simulation data');
      return;
    }

    setIsSubmitting(true);
    setStep('processing');

    try {
      const response = await axios.post('/api/offramp/execute', {
        organizationId: organization.id,
        simulationId: simulationData.executionId,
      });

      if (response.data.success) {
        toast.success('Withdrawal initiated successfully!');
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
      console.error('Error executing withdrawal:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to execute withdrawal');
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

  // Get max amount for selected token
  const getMaxAmount = () => {
    const selectedBalance = tokenBalances.find((balance) => balance.token === selectedToken);
    return selectedBalance ? selectedBalance.balance : 0;
  };

  // Set amount to max available
  const handleSetMaxAmount = () => {
    const maxAmount = getMaxAmount();
    if (maxAmount > 0) {
      setAmount(maxAmount.toString());
    }
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
        } else {
          handleOpenModal();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="p-0 font-medium text-black hover:bg-transparent hover:text-gray-600 mr-[4px]"
          onClick={() => {
            if (!isBusinessVerified) {
              toast.error('Please complete business verification first', {
                duration: 3000,
                position: 'top-center',
                icon: '🔒',
              });
              return;
            }
            if (!isWalletReady) {
              toast.error('Wallet not connected or ready', {
                duration: 3000,
                position: 'top-center',
              });
              return;
            }
            handleOpenModal();
          }}
        >
          Withdraw -
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
          <DialogTitle>Withdraw Funds</DialogTitle>
          <DialogDescription>
            Withdraw from your business wallet to your linked bank account.
          </DialogDescription>
        </DialogHeader>

        {step === 'form' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Token</Label>
              <Select
                value={selectedToken}
                onValueChange={(value: TokenType) => setSelectedToken(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a token" />
                </SelectTrigger>
                <SelectContent>
                  {tokenBalances.map((item) => (
                    <SelectItem key={item.token} value={item.token} disabled={!item.ata}>
                      {item.token} - Balance: {item.balance.toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Amount</Label>
                <button
                  type="button"
                  onClick={handleSetMaxAmount}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Max: {getMaxAmount().toFixed(2)}
                </button>
              </div>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                max={getMaxAmount()}
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
                This will withdraw funds from your business wallet to your linked payment method.
              </p>
            </div>

            <Button
              onClick={handleSimulateWithdrawal}
              className="w-full"
              disabled={
                isSubmitting ||
                !isWalletReady ||
                !amount ||
                parseFloat(amount) <= 0 ||
                (parseFloat(amount) > getMaxAmount() && getMaxAmount() > 0) ||
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
                  <span className="font-medium">1-3 Business Days*</span>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-500">
                * The funds will be debited from your wallet immediately. Bank processing may take
                1-3 business days to complete.
              </div>
            </div>

            <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
              <p>
                By proceeding, you authorize {simulationData.providerName} to process this
                withdrawal from your wallet to your bank account.
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
              <Button onClick={handleExecuteWithdrawal} disabled={isSubmitting} className="flex-1">
                {isSubmitting ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2" />
                    Processing...
                  </>
                ) : (
                  'Confirm Withdrawal'
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="py-8 text-center space-y-4">
            <Spinner className="h-8 w-8 mx-auto" />
            <p className="text-sm">Processing your withdrawal...</p>
            <p className="text-xs text-gray-500">Please do not close this window.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
