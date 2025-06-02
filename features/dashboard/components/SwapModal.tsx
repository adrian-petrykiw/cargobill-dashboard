// components/features/dashboard/components/SwapModal.tsx
import { useState, useEffect } from 'react';
import { useSolanaWallets } from '@privy-io/react-auth/solana';
import { PublicKey, Transaction } from '@solana/web3.js';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOrganizations } from '@/hooks/useOrganizations';
import { TokenBalance, TokenType } from '@/types/token';
import { ArrowUpDown, AlertTriangle, TrendingUp, Loader2, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSwap } from '../hooks/useSwap';
import { solanaService } from '@/services/blockchain/solana';
import bs58 from 'bs58';

interface SwapModalProps {
  tokenBalances: TokenBalance[];
}

// Define the supported stablecoin types for swaps
type SwapTokenType = Exclude<TokenType, 'SOL'>;

// Token display information
const TOKEN_INFO: Record<SwapTokenType, { name: string; symbol: string; icon?: string }> = {
  USDC: { name: 'USD Coin', symbol: 'USDC' },
  USDT: { name: 'Tether USD', symbol: 'USDT' },
  EURC: { name: 'Euro Coin', symbol: 'EURC' },
};

export function SwapModal({ tokenBalances }: SwapModalProps) {
  const { wallets, ready } = useSolanaWallets();
  const { organization } = useOrganizations();
  const [isOpen, setIsOpen] = useState(false);
  const [fromToken, setFromToken] = useState<SwapTokenType>('USDC');
  const [toToken, setToToken] = useState<SwapTokenType>('USDT');
  const [amount, setAmount] = useState<string>('');
  const [slippageTolerance, setSlippageTolerance] = useState<number>(0.5);
  const [step, setStep] = useState<
    'form' | 'confirmation' | 'signing' | 'processing' | 'executing'
  >('form');

  // Store simulation and preparation data in component state
  const [simulationData, setSimulationData] = useState<any>(null);
  const [preparationData, setPreparationData] = useState<any>(null);
  const [executionData, setExecutionData] = useState<any>(null);
  const [originalParams, setOriginalParams] = useState<any>(null);

  const {
    simulateSwap,
    prepareSwap,
    executeSwap,
    finalizeSwap,
    isSimulating,
    isPreparing,
    isExecuting,
    isFinalizing,
    resetSimulation,
    resetPreparation,
    resetExecution,
    resetFinalization,
  } = useSwap();

  // Get the Privy-embedded wallet
  const embeddedWallet = wallets.find((wallet) => wallet.walletClientType === 'privy');
  const publicKey = embeddedWallet?.address ? new PublicKey(embeddedWallet.address) : null;

  // Get available token types from balances
  const availableTokens = tokenBalances
    .filter((balance) => balance.token !== 'SOL' && parseFloat(balance.balance.toString()) > 0)
    .map((balance) => balance.token as SwapTokenType);

  // Get balance for selected token
  const getTokenBalance = (token: SwapTokenType): number => {
    const balance = tokenBalances.find((b) => b.token === token);
    return balance ? parseFloat(balance.balance.toString()) : 0;
  };

  const fromTokenBalance = getTokenBalance(fromToken);
  const toTokenBalance = getTokenBalance(toToken);

  // Auto-set first available token as fromToken if current selection has no balance
  useEffect(() => {
    if (availableTokens.length > 0 && !availableTokens.includes(fromToken)) {
      setFromToken(availableTokens[0]);
    }
  }, [availableTokens, fromToken]);

  // Handle token swap (flip from/to tokens)
  const handleSwapTokens = () => {
    const tempToken = fromToken;
    setFromToken(toToken);
    setToToken(tempToken);
  };

  // Handle simulation
  const handleSimulateSwap = async () => {
    if (!organization?.id) {
      toast.error('Organization not found');
      return;
    }

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (amountValue > fromTokenBalance) {
      toast.error(`Insufficient ${fromToken} balance`);
      return;
    }

    if (fromToken === toToken) {
      toast.error('Please select different tokens to swap');
      return;
    }

    try {
      // Store original parameters for execution
      const params = {
        organizationId: organization.id,
        fromToken,
        toToken,
        amount: amountValue,
        slippageTolerance,
      };

      setOriginalParams(params);

      const result = await simulateSwap.mutateAsync(params);

      // Store simulation data in component state
      setSimulationData(result);
      setStep('confirmation');
    } catch (error) {
      console.error('Simulation failed:', error);
      // Error is already handled in the hook
    }
  };

  // Handle preparation and user signing (Step 1: Proposal Creation)
  const handlePrepareSwap = async () => {
    if (!simulationData || !originalParams || !organization?.id || !embeddedWallet) {
      toast.error('Missing required data for swap preparation');
      return;
    }

    setStep('signing');

    try {
      // Prepare the swap transaction
      const preparationParams = {
        organizationId: organization.id,
        fromToken: originalParams.fromToken,
        toToken: originalParams.toToken,
        amount: originalParams.amount,
        slippageTolerance: originalParams.slippageTolerance,
        expectedAmountOut: simulationData.estimatedAmountOut,
        maxSlippageDeviation: 0.02, // 2% max deviation from original quote
      };

      console.log('Preparing swap transaction...');
      const preparation = await prepareSwap.mutateAsync(preparationParams);
      setPreparationData(preparation);

      console.log('Transaction prepared, requesting user signature for proposal...');

      // Deserialize the transaction for user signing
      const transactionBuffer = Buffer.from(preparation.serializedTransaction, 'base64');
      const transaction = Transaction.from(transactionBuffer);

      console.log('Proposal transaction details before signing:', {
        feePayer: transaction.feePayer?.toBase58(),
        instructions: transaction.instructions.length,
        blockhash: transaction.recentBlockhash,
      });

      // Sign the proposal transaction with user's wallet
      console.log('Requesting user signature for proposal via Privy wallet...');
      const signedTransaction = await embeddedWallet.signTransaction(transaction);

      console.log('Proposal transaction signed by user, proceeding to execution...');

      // Serialize the signed transaction
      const serializedSignedTransaction = Buffer.from(signedTransaction.serialize()).toString(
        'base64',
      );

      setStep('processing');

      // Execute the swap with the signed proposal transaction
      const executionResult = await executeSwap.mutateAsync({
        organizationId: organization.id,
        transactionId: preparation.transactionId,
        serializedSignedTransaction,
      });

      setExecutionData(executionResult);

      // Check if we need execution step
      if (executionResult.needsExecution && executionResult.executionTransaction) {
        console.log('Proposal approved, now need user signature for execution...');
        await handleExecuteSwap(executionResult.executionTransaction);
      } else {
        // Single-step execution completed
        console.log('Swap completed in single step');
        setIsOpen(false);
        resetForm();
      }
    } catch (error) {
      console.error('Swap preparation/execution failed:', error);

      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('User rejected')) {
          toast.error('Transaction was cancelled by user');
          setStep('confirmation'); // Go back to confirmation
        } else if (error.message.includes('expired') || error.message.includes('not found')) {
          toast.error('Transaction expired. Please try again.');
          setStep('form'); // Reset to start
          resetForm();
        } else {
          toast.error(error.message);
          setStep('confirmation'); // Go back to confirmation on other errors
        }
      }
    }
  };

  // Handle execution signing (Step 2: Execution)
  const handleExecuteSwap = async (executionTransaction: string) => {
    if (!embeddedWallet) {
      toast.error('Wallet not available for execution');
      return;
    }

    setStep('executing');

    try {
      console.log('Requesting user signature for execution transaction...');

      // Deserialize the execution transaction for user signing
      const executionTxBuffer = Buffer.from(executionTransaction, 'base64');
      const executionTx = Transaction.from(executionTxBuffer);

      console.log('Execution transaction details before signing:', {
        feePayer: executionTx.feePayer?.toBase58(),
        instructions: executionTx.instructions.length,
        blockhash: executionTx.recentBlockhash,
      });

      // Sign the execution transaction with user's wallet
      const signedExecutionTransaction = await embeddedWallet.signTransaction(executionTx);

      console.log('Execution transaction signed by user, finalizing...');

      // Serialize the signed execution transaction
      const serializedSignedExecutionTransaction = Buffer.from(
        signedExecutionTransaction.serialize(),
      ).toString('base64');

      // Finalize the swap execution
      await finalizeSwap.mutateAsync({
        serializedSignedExecutionTransaction,
        executionSignature: executionData.transactionSignature, // Pass the proposal signature
      });

      // Success handled in hook
      console.log('Swap execution completed successfully');
      setIsOpen(false);
      resetForm();
    } catch (error) {
      console.error('Swap execution failed:', error);

      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('User rejected')) {
          toast.error('Execution was cancelled by user');
          setStep('processing'); // Go back to processing state
        } else {
          toast.error(error.message);
          setStep('processing'); // Go back to processing state
        }
      }
    }
  };

  const resetForm = () => {
    setAmount('');
    setFromToken('USDC');
    setToToken('USDT');
    setSlippageTolerance(0.5);
    setStep('form');
    setSimulationData(null);
    setPreparationData(null);
    setExecutionData(null);
    setOriginalParams(null);
    resetSimulation();
    resetPreparation();
    resetExecution();
    resetFinalization();
  };

  // Calculate percentage of balance
  const getPercentageOfBalance = (percentage: number) => {
    const calculatedAmount = (fromTokenBalance * percentage) / 100;
    setAmount(calculatedAmount.toFixed(6));
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
            } else if (availableTokens.length < 2) {
              e.preventDefault();
              e.stopPropagation();
              toast.error('You need at least 2 different stablecoins to swap', {
                duration: 3000,
                position: 'top-center',
              });
              return;
            } else {
              setIsOpen(true);
            }
          }}
        >
          Swap ⇄
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-md"
        onPointerDownOutside={(e) => {
          if (isSimulating || isPreparing || isExecuting || isFinalizing) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (isSimulating || isPreparing || isExecuting || isFinalizing) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Swap Tokens</DialogTitle>
          <DialogDescription>Exchange stablecoins in your business wallet</DialogDescription>
        </DialogHeader>

        {step === 'form' && (
          <div className="space-y-4">
            {/* From Token Section */}
            <div className="space-y-2">
              <Label>From</Label>
              <div className="flex space-x-2">
                <Select
                  value={fromToken}
                  onValueChange={(value: SwapTokenType) => setFromToken(value)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TOKEN_INFO).map(([token, info]) => (
                      <SelectItem
                        key={token}
                        value={token}
                        disabled={!availableTokens.includes(token as SwapTokenType)}
                      >
                        {info.symbol}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="0"
                  step="0.000001"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex-1"
                />
              </div>
              <div className="flex justify-between items-center text-sm text-gray-500">
                <span>
                  Balance: {fromTokenBalance.toFixed(6)} {fromToken}
                </span>
                <div className="flex space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => getPercentageOfBalance(25)}
                  >
                    25%
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => getPercentageOfBalance(50)}
                  >
                    50%
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => getPercentageOfBalance(100)}
                  >
                    MAX
                  </Button>
                </div>
              </div>
            </div>

            {/* Swap Button */}
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 rounded-full border"
                onClick={handleSwapTokens}
              >
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </div>

            {/* To Token Section */}
            <div className="space-y-2">
              <Label>To</Label>
              <div className="flex space-x-2">
                <Select value={toToken} onValueChange={(value: SwapTokenType) => setToToken(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TOKEN_INFO).map(([token, info]) => (
                      <SelectItem key={token} value={token} disabled={token === fromToken}>
                        {info.symbol}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="string"
                  disabled={true}
                  value="-.------"
                  className="flex-1 bg-background"
                />
              </div>
              <div className="text-sm text-gray-500">
                Balance: {toTokenBalance.toFixed(6)} {toToken}
              </div>
            </div>

            {/* Slippage Tolerance */}
            <div className="space-y-2">
              <Label>Slippage Tolerance (%)</Label>
              <div className="flex space-x-2">
                {[0.1, 0.5, 1.0].map((preset) => (
                  <Button
                    key={preset}
                    variant={slippageTolerance === preset ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => setSlippageTolerance(preset)}
                  >
                    {preset}%
                  </Button>
                ))}
                <Input
                  type="number"
                  min="0.1"
                  max="5"
                  step="0.1"
                  value={slippageTolerance}
                  onChange={(e) => setSlippageTolerance(parseFloat(e.target.value) || 0.5)}
                  className="w-20 h-8 text-xs"
                />
              </div>
            </div>

            <div className="rounded-sm bg-blue-50 p-4 text-sm text-blue-800 border-blue-500 border-[1px]">
              <div className="flex items-start space-x-2">
                <TrendingUp className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>
                  We automatically find you best rate across multiple exchanges ensuring optimal
                  execution!
                </p>
              </div>
            </div>

            <Button
              onClick={handleSimulateSwap}
              className="w-full"
              disabled={
                isSimulating ||
                !isWalletReady ||
                !amount ||
                parseFloat(amount) <= 0 ||
                parseFloat(amount) > fromTokenBalance ||
                fromToken === toToken
              }
            >
              {isSimulating ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Getting Quote...
                </div>
              ) : (
                'Get Quote'
              )}
            </Button>
          </div>
        )}

        {step === 'confirmation' && simulationData && (
          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <h3 className="font-medium mb-3">Swap Details</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">You pay:</span>
                  <span className="font-medium">
                    {simulationData.amountIn} {simulationData.fromToken}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">You receive:</span>
                  <span className="font-medium text-green-600">
                    {simulationData.estimatedAmountOut} {simulationData.toToken}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Minimum received:</span>
                  <span className="text-sm">
                    {simulationData.minimumAmountOut} {simulationData.toToken}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Exchange rate:</span>
                  <span className="text-sm">
                    1 {simulationData.fromToken} = {simulationData.exchangeRate.toFixed(6)}{' '}
                    {simulationData.toToken}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Price impact:</span>
                  <span
                    className={cn(
                      'text-sm',
                      simulationData.priceImpact > 1 ? 'text-red-500' : 'text-green-600',
                    )}
                  >
                    {simulationData.priceImpact.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Route:</span>
                  <span className="text-sm capitalize">
                    {simulationData.route} ({simulationData.routeDetails.provider})
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Network fee:</span>
                  <span className="text-sm">{simulationData.fees.networkFee} SOL</span>
                </div>
              </div>
            </div>

            {simulationData.priceImpact > 1 && (
              <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">High Price Impact Warning</p>
                    <p>
                      This swap has a price impact of {simulationData.priceImpact.toFixed(2)}%.
                      Consider reducing the amount or splitting into smaller trades.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-lg bg-green-50 p-4 text-sm text-green-800 border-green-200 border">
              <div className="flex items-start space-x-2">
                <Shield className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Sponsored Transaction</p>
                  <p>
                    Gas fees are covered by CargoBill. You'll need to approve the swap proposal and
                    execution with your wallet.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep('form')}
                disabled={isPreparing || isExecuting || isFinalizing}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handlePrepareSwap}
                disabled={isPreparing || isExecuting || isFinalizing}
                className="flex-1"
              >
                Confirm Swap
              </Button>
            </div>
          </div>
        )}

        {step === 'signing' && (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-blue-600" />
            <p className="text-sm font-medium">Please sign the proposal transaction</p>
            <p className="text-xs text-gray-500">
              Check your wallet to approve creating the swap proposal.
            </p>
          </div>
        )}

        {step === 'processing' && (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="h-8 w-8 mx-auto animate-spin" />
            <p className="text-sm">Processing proposal...</p>
            <p className="text-xs text-gray-500">
              Your proposal is being created and approved on the blockchain.
            </p>
          </div>
        )}

        {step === 'executing' && (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-green-600" />
            <p className="text-sm font-medium">Please sign the execution transaction</p>
            <p className="text-xs text-gray-500">
              Check your wallet to approve executing the swap.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
