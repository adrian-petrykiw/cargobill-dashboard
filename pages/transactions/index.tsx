import { useState } from 'react';
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
import { Download } from 'lucide-react';
import TransactionsTable from '@/features/transactions/components/TransactionsTable';
import { Button } from '@/components/ui/button';
import { dummyTransactions } from '@/constants/dummyTransactions';

// Define filter options
const statusOptions = [
  { value: 'any', label: 'Any' },
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const timeRangeOptions = [
  { value: 'all', label: 'All Time' },
  { value: 'week', label: 'Last 7 Days' },
  { value: 'month', label: 'Last 30 Days' },
  { value: 'quarter', label: 'Last 90 Days' },
  { value: 'custom', label: 'Custom Range' },
];

// Filter header component for dropdown content
const FilterHeader = ({ title, onClear }: { title: string; onClear?: () => void }) => (
  <div className="border-b border-gray-100">
    <div className="flex items-center justify-between p-2">
      <h3 className="text-xs font-medium text-gray-900">{title}</h3>
      {onClear && (
        <button onClick={onClear} className="text-xs text-gray-500 hover:text-gray-700">
          Clear
        </button>
      )}
    </div>
  </div>
);

export default function Transactions() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('any');
  const [timeRangeFilter, setTimeRangeFilter] = useState('all');

  // Filter transactions based on search and filters
  const filteredTransactions = dummyTransactions.filter((transaction) => {
    // Search term filter
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      transaction.counterparty.toLowerCase().includes(searchLower) ||
      transaction.paymentMethod.toLowerCase().includes(searchLower) ||
      `${transaction.currency} ${transaction.amount}`.toLowerCase().includes(searchLower) ||
      (transaction.transactionId || '').toLowerCase().includes(searchLower);

    // Status filter
    const matchesStatus = statusFilter === 'any' || transaction.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleRowClick = (id: string) => {
    console.log(`View details for transaction ${id}`);
    // Navigate to transaction details page
    // router.push(`/transactions/${id}`);
  };

  const handleEdit = (id: string) => {
    console.log(`Edit transaction ${id}`);
    // Navigate to edit transaction page
    // router.push(`/transactions/${id}/edit`);
  };

  const handleCancel = (id: string) => {
    console.log(`Cancel transaction ${id}`);
    // Show confirmation dialog and cancel transaction
  };

  const handlePay = (id: string) => {
    console.log(`Pay transaction ${id}`);
    // Show payment dialog
  };

  // Reset filters
  const clearStatusFilter = () => setStatusFilter('any');
  const clearTimeRangeFilter = () => setTimeRangeFilter('all');

  return (
    <ProtectedLayout title="Transactions · CargoBill">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Transactions</h1>

          <div className="flex items-center gap-3">
            <Input
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64 h-9 text-sm bg-white"
            />
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          {/* Filters Section */}
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 text-sm h-9">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <FilterHeader
                  title="Status"
                  onClear={statusFilter !== 'any' ? clearStatusFilter : undefined}
                />
                <SelectGroup>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select value={timeRangeFilter} onValueChange={setTimeRangeFilter}>
              <SelectTrigger className="w-36 text-sm h-9">
                <SelectValue placeholder="All Time" />
              </SelectTrigger>
              <SelectContent>
                <FilterHeader
                  title="Date Range"
                  onClear={timeRangeFilter !== 'all' ? clearTimeRangeFilter : undefined}
                />
                <SelectGroup>
                  {timeRangeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            {timeRangeFilter === 'custom' && (
              <div className="h-9 px-3 border rounded-md bg-white text-sm flex items-center cursor-pointer">
                Nov 12, 2024 - Jan 1, 2025 <span className="ml-1 text-gray-400">×</span>
              </div>
            )}
          </div>

          <Button
            onClick={() => console.log('Export transactions')}
            className="h-9 flex items-center gap-1 border-none shadow-none bg-transparent hover:bg-gray-100 text-gray-600"
          >
            <Download size={16} />
            <span className="ml-1">Export</span>
          </Button>
        </div>

        {/* Transactions Table Section */}
        <div className="border rounded-md overflow-hidden">
          <TransactionsTable
            transactions={filteredTransactions}
            onRowClick={handleRowClick}
            onEdit={handleEdit}
            onCancel={handleCancel}
            onPay={handlePay}
          />
        </div>
      </div>
    </ProtectedLayout>
  );
}
