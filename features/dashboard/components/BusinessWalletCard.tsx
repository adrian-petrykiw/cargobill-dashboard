// components/features/dashboard/components/BusinessWalletCard.tsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSolanaWallets } from '@privy-io/react-auth/solana';
import { PublicKey } from '@solana/web3.js';
import { useTokenBalances } from '@/hooks/useTokenBalances';
import { BalanceChart } from './BalanceChart';
import { DepositModal } from './DepositModal';
import { WithdrawModal } from './WithdrawModal';
import { SwapModal } from './SwapModal';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useOrganizations } from '@/hooks/useOrganizations';

export function BusinessWalletCard() {
  const { wallets } = useSolanaWallets();
  const embeddedWallet = wallets.find((wallet) => wallet.walletClientType === 'privy');
  const publicKey = embeddedWallet?.address ? new PublicKey(embeddedWallet.address) : null;

  // Get organization data
  const { organization } = useOrganizations();

  // Extract multisig address from organization data
  const [multisigPda, setMultisigPda] = useState<PublicKey | null>(null);

  // Extract and set the multisig PDA from organization data
  useEffect(() => {
    if (organization?.operational_wallet?.address) {
      try {
        // Convert string to PublicKey
        const multisigAddress = new PublicKey(organization.operational_wallet.address);
        console.log('Found operational wallet multisig:', multisigAddress.toBase58());
        setMultisigPda(multisigAddress);
      } catch (error) {
        console.error('Invalid multisig address:', error);
      }
    }
  }, [organization]);

  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Use multisigPda instead of publicKey
  const {
    data: tokenBalances = [],
    isLoading,
    refetch,
    isRefetching,
  } = useTokenBalances(multisigPda);

  const handleRefresh = async () => {
    if (!multisigPda) return;

    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['tokenBalances', multisigPda.toBase58()] });
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-0">
        <div className="flex items-between justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-md font-medium">Business Wallet</h2>
            <Button
              variant="ghost"
              size="sm"
              className="p-1 h-7 w-7"
              onClick={handleRefresh}
              disabled={isRefreshing || isRefetching || isLoading || !multisigPda}
            >
              <RefreshCw
                className={cn(
                  'h-4 w-4 text-gray-500 hover:text-gray-700 transition-all',
                  (isRefreshing || isRefetching) && 'animate-spin',
                )}
              />
              <span className="sr-only">Refresh balances</span>
            </Button>
          </div>
          <div className="flex space-x-2">
            <SwapModal tokenBalances={tokenBalances} />

            <DepositModal tokenBalances={tokenBalances} />
            <WithdrawModal tokenBalances={tokenBalances} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <BalanceChart balances={tokenBalances} isLoading={isLoading || isRefetching} />
      </CardContent>
    </Card>
  );
}
