import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Pencil, X, ArrowUpDown, RefreshCw } from 'lucide-react';
import { BusinessWalletTransaction } from '@/types/businessWalletTransaction';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

type SortField = 'date' | 'transactionId' | 'counterparty' | 'paymentMethod' | 'status' | 'amount';
type SortDirection = 'asc' | 'desc';

type TransactionsTableProps = {
  transactions: BusinessWalletTransaction[];
  onRowClick?: (transaction: BusinessWalletTransaction) => void;
  onEdit?: (transaction: BusinessWalletTransaction) => void;
  onCancel?: (transaction: BusinessWalletTransaction) => void;
  onPay?: (transaction: BusinessWalletTransaction) => void;
  hasError?: boolean;
  isLoading?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  error?: Error | null;
  showOrganizationLoading?: boolean;
};

// Function to format date with timestamp if not already present
const formatDateTime = (dateStr: string): string => {
  if (dateStr === '-') return '-';

  // If the date doesn't already have a time component, add one
  if (dateStr.length <= 8 && !dateStr.includes(':')) {
    return `${dateStr} 12:00 PM`;
  }

  return dateStr;
};

const getStatusBadge = (status: BusinessWalletTransaction['status']) => {
  switch (status) {
    case 'draft':
      return (
        <Badge
          variant="outline"
          className="bg-gray-200 text-black hover:bg-gray-200 rounded px-3 py-1 text-xs"
        >
          Draft
        </Badge>
      );
    case 'open':
      return (
        <Badge
          variant="outline"
          className="bg-blue-600 text-white hover:bg-blue-100 border-blue-600 rounded px-3 py-1 text-xs"
        >
          Open
        </Badge>
      );
    case 'scheduled':
      return (
        <Badge
          variant="outline"
          className="bg-black text-white hover:bg-gray-800 border-black rounded px-3 py-1 text-xs"
        >
          Scheduled
        </Badge>
      );
    case 'pending':
      return (
        <Badge
          variant="outline"
          className="bg-orange-400 text-black hover:bg-orange-400 border-orange-400 rounded px-3 py-1 text-xs"
        >
          Pending
        </Badge>
      );
    case 'confirmed':
      return (
        <Badge
          variant="outline"
          className="bg-yellow-300 text-black hover:bg-yellow-300 border-yellow-300 rounded px-3 py-1 text-xs"
        >
          Confirmed
        </Badge>
      );
    case 'completed':
      return (
        <Badge
          variant="outline"
          className="bg-green-500 text-white hover:bg-green-500 border-green-500 rounded px-3 py-1 text-xs"
        >
          Completed
        </Badge>
      );
    case 'failed':
      return (
        <Badge
          variant="outline"
          className="bg-red-500 text-black hover:bg-red-500 border-red-500 rounded px-3 py-1 text-xs"
        >
          Failed
        </Badge>
      );
    case 'cancelled':
      return (
        <Badge
          variant="outline"
          className="bg-red-500 text-white hover:bg-red-500 border-red-500 rounded px-3 py-1 text-xs"
        >
          Cancelled
        </Badge>
      );
    default:
      return (
        <Badge
          variant="outline"
          className="bg-gray-200 text-black hover:bg-gray-200 rounded px-3 py-1 text-xs"
        >
          {status}
        </Badge>
      );
  }
};

const canBeModified = (status: BusinessWalletTransaction['status']): boolean => {
  // Only draft and scheduled transactions can be edited or cancelled
  return ['draft', 'scheduled'].includes(status);
};

export const TransactionsTable: React.FC<TransactionsTableProps> = ({
  transactions,
  onRowClick,
  onEdit,
  onCancel,
  onPay,
  hasError = false,
  isLoading = false,
  onRefresh,
  isRefreshing = false,
  error,
  showOrganizationLoading = false,
}) => {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // DEFENSIVE: Ensure transactions is always an array
  const safeTransactions = Array.isArray(transactions) ? transactions : [];

  console.log('TransactionsTable received:', {
    transactions: transactions,
    isArray: Array.isArray(transactions),
    length: Array.isArray(transactions) ? transactions.length : 'N/A',
    type: typeof transactions,
    hasError,
    isLoading,
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // DEFENSIVE: Use safeTransactions instead of transactions
  const sortedTransactions = [...safeTransactions].sort((a, b) => {
    if (!sortField) return 0;

    const direction = sortDirection === 'asc' ? 1 : -1;

    switch (sortField) {
      case 'date':
        // Sort by date and then by dueDate if date is empty
        if (a.date === '-' && b.date === '-') {
          return (a.dueDate || '') > (b.dueDate || '') ? direction : -direction;
        }
        if (a.date === '-') return direction;
        if (b.date === '-') return -direction;
        return a.date > b.date ? direction : -direction;

      case 'amount':
        // Remove currency and commas, then convert to number
        const aAmount = parseFloat(a.amount.replace(/,/g, ''));
        const bAmount = parseFloat(b.amount.replace(/,/g, ''));
        return (aAmount - bAmount) * direction;

      default:
        // Handle other fields
        const aValue = a[sortField] || '';
        const bValue = b[sortField] || '';
        return aValue > bValue ? direction : -direction;
    }
  });

  const renderSortIcon = (field: SortField) => {
    return (
      <ArrowUpDown
        size={14}
        className={`ml-1 inline ${sortField === field ? 'text-gray-900' : 'text-gray-400'}`}
      />
    );
  };

  // If invalid data type, show error state
  if (!Array.isArray(transactions)) {
    console.error('TransactionsTable: transactions prop is not an array:', {
      received: transactions,
      type: typeof transactions,
    });

    return (
      <div className="border border-gray-200 rounded-xs overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-200 h-10">
            <TableRow>
              <TableHead className="w-8 px-3">
                <Checkbox
                  className="rounded border-gray-300"
                  onClick={(e) => e.stopPropagation()}
                />
              </TableHead>
              <TableHead className="text-xs font-medium uppercase text-gray-500 px-3 py-2">
                DATE
              </TableHead>
              <TableHead className="text-xs font-medium uppercase text-gray-500 px-3 py-2">
                TRANSACTION ID
              </TableHead>
              <TableHead className="text-xs font-medium uppercase text-gray-500 px-3 py-2">
                TO/FROM
              </TableHead>
              <TableHead className="text-xs font-medium uppercase text-gray-500 px-3 py-2">
                PAYMENT METHOD
              </TableHead>
              <TableHead className="text-xs font-medium uppercase text-gray-500 px-3 py-2">
                STATUS
              </TableHead>
              <TableHead className="text-xs font-medium uppercase text-gray-500 px-3 py-2">
                AMOUNT
              </TableHead>
              <TableHead className="w-20 px-3 text-right">
                {onRefresh && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-1 h-7 w-7 hover:bg-transparent"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                  >
                    <RefreshCw
                      className={cn(
                        'h-4 w-4 text-gray-500 hover:text-gray-700 transition-all',
                        isRefreshing && 'animate-spin',
                      )}
                    />
                  </Button>
                )}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-white">
            <TableRow className="bg-white">
              <TableCell colSpan={8} className="py-8 text-center">
                <div className="text-red-600">
                  <h3 className="text-lg font-semibold mb-2">Data Error</h3>
                  <p className="mb-4">
                    Invalid transaction data received. Please refresh the page.
                  </p>
                  {onRefresh && (
                    <Button onClick={onRefresh} variant="outline" size="sm">
                      Try Again
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-md overflow-hidden">
      <Table>
        <TableHeader className="bg-slate-200 h-10">
          <TableRow>
            <TableHead className="w-8 px-3">
              <Checkbox className="rounded border-gray-300" onClick={(e) => e.stopPropagation()} />
            </TableHead>
            <TableHead
              className="text-xs font-medium uppercase text-gray-500 px-3 py-2 cursor-pointer"
              onClick={() => handleSort('date')}
            >
              DATE {renderSortIcon('date')}
            </TableHead>
            <TableHead
              className="text-xs font-medium uppercase text-gray-500 px-3 py-2 cursor-pointer"
              onClick={() => handleSort('transactionId')}
            >
              TRANSACTION ID {renderSortIcon('transactionId')}
            </TableHead>
            <TableHead
              className="text-xs font-medium uppercase text-gray-500 px-3 py-2 cursor-pointer"
              onClick={() => handleSort('counterparty')}
            >
              TO/FROM {renderSortIcon('counterparty')}
            </TableHead>
            <TableHead
              className="text-xs font-medium uppercase text-gray-500 px-3 py-2 cursor-pointer"
              onClick={() => handleSort('paymentMethod')}
            >
              PAYMENT METHOD {renderSortIcon('paymentMethod')}
            </TableHead>
            <TableHead
              className="text-xs font-medium uppercase text-gray-500 px-3 py-2 cursor-pointer"
              onClick={() => handleSort('status')}
            >
              STATUS {renderSortIcon('status')}
            </TableHead>
            <TableHead
              className="text-xs font-medium uppercase text-gray-500 px-3 py-2 cursor-pointer"
              onClick={() => handleSort('amount')}
            >
              AMOUNT {renderSortIcon('amount')}
            </TableHead>
            <TableHead className="w-20 px-3 text-right">
              {onRefresh && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-1 h-7 w-7 hover:bg-transparent"
                  onClick={onRefresh}
                  disabled={isRefreshing || isLoading || showOrganizationLoading}
                >
                  <RefreshCw
                    className={cn(
                      'h-4 w-4 text-gray-500 hover:text-gray-700 transition-all',
                      (isRefreshing || isLoading) && 'animate-spin',
                    )}
                  />
                </Button>
              )}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-gray-200 bg-white">
          {showOrganizationLoading ? (
            // Show skeleton loading rows when organization is loading
            <>
              {[...Array(5)].map((_, index) => (
                <TableRow key={`skeleton-${index}`} className="bg-white h-10">
                  <TableCell className="px-3 py-2 align-middle h-10">
                    <div className="w-4 h-4 bg-gray-200 rounded animate-pulse"></div>
                  </TableCell>
                  <TableCell className="px-3 py-2 align-middle h-10">
                    <div className="w-20 h-3 bg-gray-200 rounded animate-pulse"></div>
                  </TableCell>
                  <TableCell className="px-3 py-2 align-middle h-10">
                    <div className="w-16 h-3 bg-gray-200 rounded animate-pulse"></div>
                  </TableCell>
                  <TableCell className="px-3 py-2 align-middle h-10">
                    <div className="w-24 h-3 bg-gray-200 rounded animate-pulse"></div>
                  </TableCell>
                  <TableCell className="px-3 py-2 align-middle h-10">
                    <div className="w-20 h-3 bg-gray-200 rounded animate-pulse"></div>
                  </TableCell>
                  <TableCell className="px-3 py-2 align-middle h-10">
                    <div className="w-16 h-5 bg-gray-200 rounded animate-pulse"></div>
                  </TableCell>
                  <TableCell className="px-3 py-2 align-middle h-10">
                    <div className="w-16 h-3 bg-gray-200 rounded animate-pulse"></div>
                  </TableCell>
                  <TableCell className="px-3 py-2 align-middle h-10">
                    <div className="w-8 h-8 bg-gray-200 rounded animate-pulse"></div>
                  </TableCell>
                </TableRow>
              ))}
            </>
          ) : hasError ? (
            <TableRow className="bg-white">
              <TableCell colSpan={8} className="py-8 text-center">
                <div className="text-red-600">
                  <h3 className="text-lg font-semibold mb-2">Failed to fetch transactions</h3>
                  <p className="text-gray-600 mb-4">
                    {error instanceof Error
                      ? error.message
                      : 'An unexpected error occurred while loading transactions.'}
                  </p>
                  {onRefresh && (
                    <Button onClick={onRefresh} variant="outline" size="sm" disabled={isRefreshing}>
                      {isRefreshing ? 'Retrying...' : 'Try Again'}
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ) : isLoading ? (
            <TableRow className="bg-white">
              <TableCell colSpan={8} className="py-8 text-center text-gray-500">
                <div className="flex items-center justify-center space-x-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Loading transactions...</span>
                </div>
              </TableCell>
            </TableRow>
          ) : sortedTransactions.length === 0 ? (
            <TableRow className="bg-white">
              <TableCell colSpan={8} className="py-8 text-center text-gray-500">
                No transactions found
              </TableCell>
            </TableRow>
          ) : (
            sortedTransactions.map((transaction) => (
              <TableRow
                key={transaction.id}
                className="bg-white h-10 hover:bg-gray-50 cursor-pointer"
                onClick={() => onRowClick?.(transaction)}
              >
                <TableCell className="px-3 py-2 align-middle h-10">
                  <Checkbox onClick={(e) => e.stopPropagation()} />
                </TableCell>

                <TableCell className="px-3 py-2 text-xs text-gray-500 align-middle h-10">
                  {transaction.status === 'open' && transaction.dueDate ? (
                    <div>Due {formatDateTime(transaction.dueDate)}</div>
                  ) : (
                    <>
                      {formatDateTime(transaction.date)}
                      {transaction.dueDate && transaction.status !== 'open' && (
                        <div>Due {formatDateTime(transaction.dueDate)}</div>
                      )}
                    </>
                  )}
                </TableCell>
                <TableCell className="px-3 py-2 text-xs align-middle font-mono h-10">
                  {transaction.transactionId
                    ? transaction.transactionId.length > 10
                      ? `${transaction.transactionId.substring(0, 5)}...${transaction.transactionId.substring(transaction.transactionId.length - 5)}`
                      : transaction.transactionId
                    : '-'}
                </TableCell>
                <TableCell className="px-3 py-2 text-xs align-middle h-10">
                  {transaction.counterparty}
                </TableCell>
                <TableCell className="px-3 py-2 text-xs align-middle h-10">
                  {transaction.paymentMethod}
                </TableCell>
                <TableCell className="px-3 py-2 text-xs align-middle h-10">
                  {getStatusBadge(transaction.status)}
                </TableCell>
                <TableCell className="px-3 py-2 text-xs align-middle h-10">
                  {transaction.currency} {transaction.amount}
                </TableCell>
                <TableCell className="px-3 py-2 text-xs align-middle h-10">
                  <div
                    className="flex space-x-2 items-center justify-end h-8"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {onPay && transaction.status === 'open' ? (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPay(transaction);
                        }}
                        className="h-8 flex items-center gap-1 border-none shadow-none bg-transparent font-semibold text-xs hover:bg-slate-100 text-slate-600 p-3"
                      >
                        Pay
                      </Button>
                    ) : canBeModified(transaction.status) ? (
                      <>
                        {onEdit && (
                          <button
                            className="text-slate-900 h-8 w-8 flex items-center justify-center rounded hover:bg-slate-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(transaction);
                            }}
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {onCancel && (
                          <button
                            className="text-red-600 h-8 w-8 flex items-center justify-center rounded hover:bg-slate-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCancel(transaction);
                            }}
                          >
                            <X size={18} />
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="h-8"></div> // Empty div to maintain consistent row height
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default TransactionsTable;
