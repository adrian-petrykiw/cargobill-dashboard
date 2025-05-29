// pages/transactions/index.tsx
import { useState, useMemo } from 'react';
import ProtectedLayout from '@/components/layouts/ProtectedLayout';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { TransactionsTable } from '@/features/transactions/components/TransactionsTable';
import { useTransactions } from '@/features/transactions/hooks/useTransactions';
import { useOrganizations } from '@/hooks/useOrganizations';
import { mapTransactionToBusinessWallet } from '@/lib/formatters/transactionMappers';
import { BusinessWalletTransaction } from '@/types/businessWalletTransaction';
import { Transaction } from '@/schemas/transaction.schema';
import { toast } from 'react-hot-toast';
import PayTransactionModal from '@/features/transactions/components/PayTransactionModal';
import EditTransactionModal from '@/features/transactions/components/EditTransactionModal';
import CancelTransactionModal from '@/features/transactions/components/CancelTransactionModal';
import { Download, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const { organization } = useOrganizations();
  const organizationId = organization?.id;

  // Use your existing hook structure
  const { organizationTransactions, isLoading, organizationTransactionsError, refetchAll } =
    useTransactions(organizationId);

  // DEFENSIVE: Add debugging for the data we receive from the hook
  console.log('TransactionsPage data:', {
    organizationId,
    organizationTransactions,
    isArray: Array.isArray(organizationTransactions),
    length: Array.isArray(organizationTransactions) ? organizationTransactions.length : 'N/A',
    isLoading,
    hasError: !!organizationTransactionsError,
  });

  // Local state for filtering and search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'sent' | 'received'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modal states - store the original Transaction object
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  // Filter and search transactions in the UI
  const filteredAndMappedTransactions = useMemo(() => {
    console.log('useMemo running with:', {
      organizationId,
      organizationTransactions,
      isArray: Array.isArray(organizationTransactions),
      length: Array.isArray(organizationTransactions) ? organizationTransactions.length : 'N/A',
    });

    // DEFENSIVE: Ensure we always work with an array
    if (!organizationId) {
      console.log('No organizationId, returning empty array');
      return [];
    }

    // DEFENSIVE: Ensure organizationTransactions is an array
    if (!Array.isArray(organizationTransactions)) {
      console.error('organizationTransactions is not an array:', {
        received: organizationTransactions,
        type: typeof organizationTransactions,
      });
      return [];
    }

    if (organizationTransactions.length === 0) {
      console.log('No transactions available, returning empty array');
      return [];
    }

    try {
      // First filter by direction (sent/received/all)
      const directionFiltered = organizationTransactions.filter((transaction: Transaction) => {
        if (typeFilter === 'all') return true;

        const isSent = transaction.sender_organization_id === organizationId;
        if (typeFilter === 'sent') return isSent;
        if (typeFilter === 'received') return !isSent;

        return true;
      });

      console.log('After direction filter:', {
        original: organizationTransactions.length,
        filtered: directionFiltered.length,
        typeFilter,
      });

      // Map to BusinessWalletTransaction format
      const mappedTransactions = directionFiltered.map((transaction: Transaction) => {
        try {
          return mapTransactionToBusinessWallet(transaction, organizationId);
        } catch (error) {
          console.error('Error mapping transaction:', error, transaction);
          // Return a safe fallback object
          return {
            id: transaction.id || 'unknown',
            transactionId: transaction.signature || undefined,
            date: '-',
            dueDate: undefined,
            category: 'Unknown',
            counterparty: 'Unknown',
            notes: undefined,
            paymentMethod: 'Unknown',
            status: 'pending' as const,
            amount: '0.00',
            currency: 'USDC',
          } as BusinessWalletTransaction;
        }
      });

      console.log('After mapping:', {
        mapped: mappedTransactions.length,
        sample: mappedTransactions[0] || 'none',
      });

      // Apply additional filters
      const finalFiltered = mappedTransactions.filter((transaction: BusinessWalletTransaction) => {
        try {
          // Search filter
          const searchLower = searchTerm.toLowerCase();
          const matchesSearch =
            searchTerm === '' ||
            transaction.counterparty?.toLowerCase().includes(searchLower) ||
            transaction.category?.toLowerCase().includes(searchLower) ||
            transaction.paymentMethod?.toLowerCase().includes(searchLower) ||
            transaction.notes?.toLowerCase().includes(searchLower) ||
            transaction.transactionId?.toLowerCase().includes(searchLower) ||
            transaction.amount?.toLowerCase().includes(searchLower);

          // Status filter
          const matchesStatus = statusFilter === 'all' || transaction.status === statusFilter;

          // Category filter
          const matchesCategory =
            categoryFilter === 'all' || transaction.category === categoryFilter;

          return matchesSearch && matchesStatus && matchesCategory;
        } catch (error) {
          console.error('Error filtering transaction:', error, transaction);
          return false; // Exclude transactions that can't be filtered
        }
      });

      console.log('Final filtered result:', {
        count: finalFiltered.length,
        isArray: Array.isArray(finalFiltered),
      });

      return finalFiltered;
    } catch (error) {
      console.error('Error in filteredAndMappedTransactions useMemo:', error);
      return []; // Return empty array on any error
    }
  }, [
    organizationTransactions,
    organizationId,
    typeFilter,
    searchTerm,
    statusFilter,
    categoryFilter,
  ]);

  // Get unique categories for filter dropdown
  const uniqueCategories = useMemo(() => {
    try {
      // DEFENSIVE: Ensure we always work with an array
      if (!Array.isArray(organizationTransactions) || organizationTransactions.length === 0) {
        return [];
      }

      const categories = new Set<string>();

      organizationTransactions.forEach((transaction: Transaction) => {
        try {
          const mapped = mapTransactionToBusinessWallet(transaction, organizationId || '');
          if (mapped.category) {
            categories.add(mapped.category);
          }
        } catch (error) {
          console.error('Error getting category for transaction:', error, transaction);
        }
      });

      return Array.from(categories).sort();
    } catch (error) {
      console.error('Error computing unique categories:', error);
      return [];
    }
  }, [organizationTransactions, organizationId]);

  // Helper function to find original transaction by BusinessWalletTransaction ID
  const findOriginalTransaction = (businessWalletTransactionId: string): Transaction | null => {
    try {
      if (!Array.isArray(organizationTransactions)) {
        console.error('Cannot find transaction: organizationTransactions is not an array');
        return null;
      }

      return (
        organizationTransactions.find((tx: Transaction) => tx.id === businessWalletTransactionId) ||
        null
      );
    } catch (error) {
      console.error('Error finding original transaction:', error);
      return null;
    }
  };

  // Handle transaction actions - find original transaction and pass it to modals
  const handlePayTransaction = (transaction: BusinessWalletTransaction) => {
    const originalTransaction = findOriginalTransaction(transaction.id);
    if (originalTransaction) {
      setSelectedTransaction(originalTransaction);
      setPayModalOpen(true);
    } else {
      toast.error('Unable to find transaction details');
    }
  };

  const handleEditTransaction = (transaction: BusinessWalletTransaction) => {
    const originalTransaction = findOriginalTransaction(transaction.id);
    if (originalTransaction) {
      setSelectedTransaction(originalTransaction);
      setEditModalOpen(true);
    } else {
      toast.error('Unable to find transaction details');
    }
  };

  const handleCancelTransaction = (transaction: BusinessWalletTransaction) => {
    const originalTransaction = findOriginalTransaction(transaction.id);
    if (originalTransaction) {
      setSelectedTransaction(originalTransaction);
      setCancelModalOpen(true);
    } else {
      toast.error('Unable to find transaction details');
    }
  };

  const handleExportTransactions = () => {
    toast.success('Export functionality coming soon!');
  };

  const handleRefresh = async () => {
    if (!organizationId) return;

    console.log('Refresh clicked, setting isRefreshing to true'); // Debug log
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({
        queryKey: ['transactions', 'organization', organizationId],
      });
      await refetchAll();
    } finally {
      console.log('Refresh complete, setting isRefreshing to false'); // Debug log
      setIsRefreshing(false);
    }
  };

  // Close modals and refetch data
  const closeModalAndRefetch = async () => {
    setSelectedTransaction(null);
    setPayModalOpen(false);
    setEditModalOpen(false);
    setCancelModalOpen(false);
    await refetchAll();
  };

  if (!organizationId) {
    return (
      <ProtectedLayout>
        <div className="container mx-auto py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-600 mb-4">No Organization Selected</h1>
            <p className="text-gray-600">Please select an organization to view transactions.</p>
          </div>
        </div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="container mx-auto pb-8 space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Transactions</h1>
          </div>
          <Button
            onClick={handleExportTransactions}
            variant="ghost"
            className="hover:bg-slate-200 border-none shadow-none bg-transparent"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          {/* Search */}
          <div className="flex-1">
            <Input
              placeholder="Search transactions by counterparty, category, payment method, or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Direction Filter */}
          <div className="w-full sm:w-48">
            <Select
              value={typeFilter}
              onValueChange={(value: 'all' | 'sent' | 'received') => setTypeFilter(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Transactions" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All Transactions</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-48">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* Category Filter */}
          <div className="w-full sm:w-48">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All Categories</SelectItem>
                  {uniqueCategories.map((category: string) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Transactions Table - Always show the table structure */}
        <TransactionsTable
          transactions={
            Array.isArray(filteredAndMappedTransactions) ? filteredAndMappedTransactions : []
          }
          onPay={handlePayTransaction}
          onEdit={handleEditTransaction}
          onCancel={handleCancelTransaction}
          hasError={!!organizationTransactionsError}
          isLoading={isLoading}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          error={organizationTransactionsError}
        />

        {/* Results Summary - Moved to bottom right */}
        {!organizationTransactionsError && (
          <div className="flex justify-end">
            <div className="text-sm text-muted-foreground">
              Showing{' '}
              {Array.isArray(filteredAndMappedTransactions)
                ? filteredAndMappedTransactions.length
                : 0}{' '}
              of {Array.isArray(organizationTransactions) ? organizationTransactions.length : 0}{' '}
              transactions
              {typeFilter !== 'all' && ` (${typeFilter})`}
            </div>
          </div>
        )}

        {/* Modals - Now pass the original Transaction objects */}
        {selectedTransaction && (
          <>
            <PayTransactionModal
              open={payModalOpen}
              onClose={closeModalAndRefetch}
              transaction={selectedTransaction}
            />

            <EditTransactionModal
              open={editModalOpen}
              onClose={closeModalAndRefetch}
              transaction={selectedTransaction}
            />

            <CancelTransactionModal
              open={cancelModalOpen}
              onClose={closeModalAndRefetch}
              transaction={selectedTransaction}
            />
          </>
        )}
      </div>
    </ProtectedLayout>
  );
}
