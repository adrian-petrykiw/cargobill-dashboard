// pages/banking/index.tsx
import { useState, useEffect } from 'react';
import ProtectedLayout from '@/components/layouts/ProtectedLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Copy, Plus, RefreshCw, DollarSign } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Spinner from '@/components/common/Spinner';
import type { BankingTransfer } from '@/schemas/banking.schema';
import { useFBODetails, useFBOTransfers } from '@/features/banking/hooks/useBanking';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useSolanaWallets } from '@privy-io/react-auth';
import { PublicKey } from '@solana/web3.js';

export default function Banking() {
  const { wallets, ready } = useSolanaWallets();
  const embeddedWallet = wallets.find((wallet) => wallet.walletClientType === 'privy');

  const [hasShownFBOError, setHasShownFBOError] = useState(false);

  // Get organization data first
  const { organization, isLoading: isLoadingOrg } = useOrganizations();

  // Check if organization has FBO account
  const hasFBOAccount = Boolean(organization?.fbo_account_id);

  // Only make API calls if FBO account exists
  const {
    accountDetails,
    isLoading: isLoadingAccount,
    error: accountError,
    refetch: refetchAccount,
  } = useFBODetails(hasFBOAccount);

  const {
    transfers,
    isLoading: isLoadingTransfers,
    error: transfersError,
    refetch: refetchTransfers,
  } = useFBOTransfers(undefined, hasFBOAccount);

  // Show FBO error toast once when component loads and no FBO account
  useEffect(() => {
    if (!isLoadingOrg && !hasFBOAccount && !hasShownFBOError) {
      toast.error('Please contact support to enable CargoBill banking');
      setHasShownFBOError(true);
    }
  }, [isLoadingOrg, hasFBOAccount, hasShownFBOError]);

  const handleCopyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${type} copied to clipboard`);
    } catch (error) {
      toast.error(`Failed to copy ${type}`);
    }
  };

  const formatAmount = (amount: string): string => {
    const num = parseFloat(amount);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      COMPLETED: 'bg-green-100 text-green-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      FAILED: 'bg-red-100 text-red-800',
      PROCESSING: 'bg-blue-100 text-blue-800',
      CANCELLED: 'bg-gray-100 text-gray-800',
    } as const;

    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
          statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'
        }`}
      >
        {status}
      </span>
    );
  };

  const maskAccountNumber = (accountNumber: string): string => {
    if (accountNumber.length <= 4) return accountNumber;
    return '••••••••' + accountNumber.slice(-4);
  };

  const maskRoutingNumber = (routingNumber: string): string => {
    if (routingNumber.length <= 4) return routingNumber;
    return '•••••' + routingNumber.slice(-4);
  };

  // const handleRefresh = (): void => {
  //   refetchAccount();
  //   refetchTransfers();
  //   toast.success('Data refreshed');
  // };

  const isBusinessVerified = !!(
    organization &&
    organization.last_verified_at !== null &&
    organization.verification_status === 'verified'
  );

  // Check if wallet is ready and connected
  const isWalletReady = ready && !!embeddedWallet?.address;

  return (
    <ProtectedLayout title="Banking · CargoBill">
      <div className="space-y-6">
        {/* Header with New Transfer button */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Banking</h1>
          <div className="flex items-center gap-2">
            {/* <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button> */}
            <Button
              className="h-8"
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
                  // handleOpenModal();
                  toast.error('Contact support to unlock transfers', {
                    duration: 3000,
                    position: 'top-center',
                  });
                }
              }}
            >
              <Plus className="h-4 w-4" />
              New Transfer
            </Button>
          </div>
        </div>

        {/* Account Balance Section */}
        <Card className="bg-white border-gray-200">
          <CardContent className="pt-0">
            {!hasFBOAccount ? (
              <div className="flex items-end justify-between py-4">
                <div className="flex items-center space-x-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Current Balance</p>
                    <p className="text-3xl font-bold text-gray-900">NA</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 mb-1">Available Balance</p>
                  <p className="text-sm text-gray-900">NA</p>
                </div>
              </div>
            ) : isLoadingAccount ? (
              <div className="flex items-end justify-between py-4">
                <div className="flex items-center space-x-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Current Balance</p>
                    <Skeleton className="h-9 w-20 bg-gray-600/20" />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 mb-1">Available Balance</p>
                  <Skeleton className="h-4 w-16 bg-gray-600/20" />
                </div>
              </div>
            ) : accountError ? (
              <div className="text-center py-8">
                <p className="text-red-500 text-sm mb-4">
                  Error loading balance: {(accountError as Error).message}
                </p>
                <Button variant="outline" size="sm" onClick={() => refetchAccount()}>
                  Retry
                </Button>
              </div>
            ) : accountDetails ? (
              <div className="flex items-end justify-between">
                <div className="flex items-center space-x-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Current Balance</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {accountDetails.balance ? formatAmount(accountDetails.balance) : 'NA'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 mb-1">Available Balance</p>
                  <p className="text-sm text-gray-900">
                    {accountDetails.balance ? formatAmount(accountDetails.balance) : 'NA'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No balance information available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Details Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-md font-medium">Account Details</h2>
          </div>
          <Card>
            <CardContent className="space-y-10">
              {!hasFBOAccount ? (
                <div className="flex flex-col sm:flex-row sm:items-start gap-6 sm:gap-8">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">ACH Account Number</h3>
                    <p className="text-sm text-gray-900">NA</p>
                  </div>

                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">ACH Routing Number</h3>
                    <p className="text-sm text-gray-900">NA</p>
                  </div>

                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Account Type</h3>
                    <p className="text-sm text-gray-900">NA</p>
                  </div>

                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Account Status</h3>
                    <p className="text-sm text-gray-900">NA</p>
                  </div>
                </div>
              ) : isLoadingAccount ? (
                <div className="flex flex-col sm:flex-row sm:items-start gap-6 sm:gap-8">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">ACH Account Number</h3>
                    <Skeleton className="h-6 w-full bg-gray-600/20" />
                  </div>

                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">ACH Routing Number</h3>
                    <Skeleton className="h-6 w-full bg-gray-600/20" />
                  </div>

                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Account Type</h3>
                    <Skeleton className="h-6 w-full bg-gray-600/20" />
                  </div>

                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Account Status</h3>
                    <Skeleton className="h-6 w-full bg-gray-600/20" />
                  </div>
                </div>
              ) : accountError ? (
                <div className="text-center py-8">
                  <p className="text-red-500 text-sm mb-4">
                    Error loading account details: {(accountError as Error).message}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => refetchAccount()}>
                    Retry
                  </Button>
                </div>
              ) : accountDetails ? (
                <div className="flex flex-col sm:flex-row sm:items-start gap-6 sm:gap-8">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">ACH Account Number</h3>
                    <div className="flex items-center">
                      <p className="font-mono text-sm">
                        {maskAccountNumber(accountDetails.account_num)}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 ml-2"
                        onClick={() =>
                          handleCopyToClipboard(accountDetails.account_num, 'ACH Account number')
                        }
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">ACH Routing Number</h3>
                    <div className="flex items-center">
                      <p className="font-mono text-sm">
                        {maskRoutingNumber(accountDetails.routing_num)}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 ml-2"
                        onClick={() =>
                          handleCopyToClipboard(accountDetails.routing_num, 'Routing number')
                        }
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Account ID</h3>
            <p className="text-sm font-mono text-gray-600">{accountDetails.account_id}</p>
          </div> */}

                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Account Type</h3>
                    <p className="text-sm">{accountDetails.account_type}</p>
                  </div>

                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Account Status</h3>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        accountDetails.account_status === 'ACTIVE'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {accountDetails.account_status}
                    </span>
                  </div>

                  {/* <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Account Name</h3>
            <p className="text-sm">{accountDetails.account_name}</p>
          </div> */}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No account details available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Transfer History Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-md font-medium">Transfer History</h2>
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="text-xs uppercase text-gray-500 py-3 px-6">
                      Date
                    </TableHead>
                    <TableHead className="text-xs uppercase text-gray-500 py-3 px-6">
                      Type
                    </TableHead>
                    <TableHead className="text-xs uppercase text-gray-500 py-3 px-6">
                      Method
                    </TableHead>
                    <TableHead className="text-xs uppercase text-gray-500 py-3 px-6">
                      Description
                    </TableHead>
                    <TableHead className="text-xs uppercase text-gray-500 py-3 px-6">
                      Status
                    </TableHead>
                    <TableHead className="text-xs uppercase text-gray-500 py-3 px-6 text-right">
                      Amount
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-200">
                  {!hasFBOAccount ? (
                    <TableRow>
                      <TableCell
                        className="text-center text-xs text-gray-500 py-8 px-6"
                        colSpan={6}
                      >
                        No transfers found
                      </TableCell>
                    </TableRow>
                  ) : isLoadingTransfers ? (
                    <TableRow>
                      <TableCell className="text-center py-8 px-6" colSpan={6}>
                        <div className="flex items-center justify-center">
                          <Spinner size="sm" className="mr-3" />
                          <span className="text-xs text-gray-500">Loading transfers...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : transfersError ? (
                    <TableRow>
                      <TableCell className="text-center py-8 px-6" colSpan={6}>
                        <p className="text-xs text-red-500 mb-2">
                          Error loading transfers: {(transfersError as Error).message}
                        </p>
                        <Button variant="outline" size="sm" onClick={() => refetchTransfers()}>
                          Retry
                        </Button>
                      </TableCell>
                    </TableRow>
                  ) : transfers && transfers.values.length > 0 ? (
                    transfers.values.map((transfer: BankingTransfer) => (
                      <TableRow key={transfer.transfer_id} className="hover:bg-gray-50">
                        <TableCell className="text-xs py-4 px-6">
                          {formatDate(transfer.transfer_date)}
                        </TableCell>
                        <TableCell className="text-xs py-4 px-6">
                          <span className="capitalize">{transfer.transfer_type.toLowerCase()}</span>
                        </TableCell>
                        <TableCell className="text-xs py-4 px-6">
                          <span className="capitalize">
                            {transfer.transfer_method.toLowerCase()}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs py-4 px-6 max-w-xs truncate">
                          {transfer.transfer_name || transfer.purpose || 'No description'}
                        </TableCell>
                        <TableCell className="text-xs py-4 px-6">
                          {getStatusBadge(transfer.transfer_status)}
                        </TableCell>
                        <TableCell className="text-xs py-4 px-6 text-right font-mono">
                          <span
                            className={`${
                              transfer.transfer_type === 'DEBIT' ? 'text-red-600' : 'text-green-600'
                            }`}
                          >
                            {transfer.transfer_type === 'DEBIT' ? '-' : '+'}
                            {formatAmount(transfer.transfer_amount)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        className="text-center text-xs text-gray-500 py-8 px-6"
                        colSpan={6}
                      >
                        No transfers found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>
    </ProtectedLayout>
  );
}
