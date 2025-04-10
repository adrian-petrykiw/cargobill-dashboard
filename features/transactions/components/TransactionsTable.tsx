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
import { Pencil, X, ArrowUpDown } from 'lucide-react';
import { BusinessWalletTransaction } from '@/types/businessWalletTransaction';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

type SortField = 'date' | 'transactionId' | 'counterparty' | 'paymentMethod' | 'status' | 'amount';
type SortDirection = 'asc' | 'desc';

type TransactionsTableProps = {
  transactions: BusinessWalletTransaction[];
  onRowClick?: (id: string) => void;
  onEdit?: (id: string) => void;
  onCancel?: (id: string) => void;
  onPay?: (id: string) => void;
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
          className="bg-gray-200 text-gray-800 hover:bg-gray-200 rounded px-3 py-1 text-xs"
        >
          Draft
        </Badge>
      );
    case 'open':
      return (
        <Badge
          variant="outline"
          className="bg-blue-100 text-blue-800 hover:bg-blue-100 rounded px-3 py-1 text-xs"
        >
          Open
        </Badge>
      );
    case 'scheduled':
      return (
        <Badge
          variant="outline"
          className="bg-gray-900 text-white hover:bg-gray-800 rounded px-3 py-1 text-xs"
        >
          Scheduled
        </Badge>
      );
    case 'pending':
      return (
        <Badge
          variant="outline"
          className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 rounded px-3 py-1 text-xs"
        >
          Pending
        </Badge>
      );
    case 'confirmed':
      return (
        <Badge
          variant="outline"
          className="bg-yellow-200 text-yellow-800 hover:bg-yellow-200 rounded px-3 py-1 text-xs"
        >
          Confirmed
        </Badge>
      );
    case 'completed':
      return (
        <Badge
          variant="outline"
          className="bg-green-100 text-green-800 hover:bg-green-100 rounded px-3 py-1 text-xs"
        >
          Completed
        </Badge>
      );
    case 'failed':
      return (
        <Badge
          variant="outline"
          className="bg-red-100 text-red-800 hover:bg-red-100 rounded px-3 py-1 text-xs"
        >
          Failed
        </Badge>
      );
    case 'cancelled':
      return (
        <Badge
          variant="outline"
          className="bg-red-100 text-red-800 hover:bg-red-100 rounded px-3 py-1 text-xs"
        >
          Cancelled
        </Badge>
      );
    default:
      return (
        <Badge
          variant="outline"
          className="bg-gray-200 text-gray-800 hover:bg-gray-200 rounded px-3 py-1 text-xs"
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
}) => {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedTransactions = [...transactions].sort((a, b) => {
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

  return (
    <div className="overflow-x-auto">
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
            <TableHead className="w-20 px-3"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-gray-200">
          {sortedTransactions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="py-6 text-center text-white">
                No transactions found
              </TableCell>
            </TableRow>
          ) : (
            sortedTransactions.map((transaction) => (
              <TableRow
                key={transaction.id}
                className=" bg-white  h-10"
                // onClick={() => onRowClick?.(transaction.id)}
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
                          onPay(transaction.id);
                        }}
                        className="h-8 flex items-center gap-1 border-none shadow-none bg-transparent hover:bg-gray-100 text-gray-600 p-3"
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
                              onEdit(transaction.id);
                            }}
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                        {onCancel && (
                          <button
                            className="text-red-600 h-8 w-8 flex items-center justify-center rounded hover:bg-slate-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCancel(transaction.id);
                            }}
                          >
                            <X size={16} />
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
