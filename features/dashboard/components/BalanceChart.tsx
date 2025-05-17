// components/features/dashboard/components/BalanceChart.tsx
import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TokenBalance, TokenType } from '@/types/token';

// Mock data for the chart - this would be replaced with real data
const generateMockData = (balances: TokenBalance[], visibleTokens: TokenType[]) => {
  // Generate 12 months of mock data
  return Array.from({ length: 12 }, (_, i) => {
    const month = new Date(2025, i, 1).toLocaleString('default', { month: 'short' });

    // Basic data
    const result: any = { month };

    // Calculate randomized values for each token
    // In a real implementation, this would come from historical data
    visibleTokens.forEach((token) => {
      const tokenBalance = balances.find((b) => b.token === token)?.balance || 0;
      // Create some random growth pattern
      const factor = 1 + (i / 12) * (Math.random() * 0.5 + 0.5);
      result[token] = tokenBalance * factor;
    });

    return result;
  });
};

interface BalanceChartProps {
  balances: TokenBalance[];
  isLoading: boolean;
}

export const BalanceChart: React.FC<BalanceChartProps> = ({ balances, isLoading }) => {
  const [visibleTokens, setVisibleTokens] = useState<TokenType[]>(['USDC', 'USDT', 'EURC']);

  const toggleToken = (token: TokenType) => {
    setVisibleTokens((prev) => {
      if (prev.includes(token)) {
        // Don't allow removing the last token
        if (prev.length === 1) return prev;
        return prev.filter((t) => t !== token);
      }
      return [...prev, token];
    });
  };

  const chartData = generateMockData(balances, visibleTokens);

  // Colors for tokens
  const tokenColors = {
    USDC: '#2775CA', // USDC blue
    USDT: '#26A17B', // USDT green
    EURC: '#052D56', // EURC navy blue
  };

  // Get the total balance
  const totalBalance = balances
    .filter((balance) => visibleTokens.includes(balance.token))
    .reduce((sum, item) => sum + item.balance, 0);

  return (
    <div className="w-full">
      <div className="mb-2">
        <div className="text-xs text-gray-500">Total Balance</div>
        {isLoading ? (
          <Skeleton className="h-7 w-32" />
        ) : (
          <div className="text-lg font-semibold">${totalBalance.toFixed(2)} USD</div>
        )}
      </div>

      <div className="aspect-[16/6] w-full mb-0">
        {isLoading ? (
          <div className="aspect-[12/3] bg-gray-100 border-gray-200 border-[1px] rounded-md mb-2">
            <Skeleton className="h-full w-full" />
          </div>
        ) : (
          <div className="aspect-[12/3] border-gray-200 border-[1px] rounded-md mb-2 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                {visibleTokens.map((token) => (
                  <Area
                    key={token}
                    type="monotone"
                    dataKey={token}
                    stackId="1"
                    stroke={tokenColors[token]}
                    fill={tokenColors[token]}
                    fillOpacity={0.6}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="flex justify-between space-x-2 p-1 bg-white border-gray-200 border-[1px] rounded-md">
          {balances.map((tokenBalance) => (
            <Badge
              key={tokenBalance.token}
              className={`w-[100%] justify-center text-[10px] py-1 rounded-sm hover:cursor-pointer ${
                visibleTokens.includes(tokenBalance.token)
                  ? 'bg-slate-900 text-white hover:bg-slate-800'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
              onClick={() => toggleToken(tokenBalance.token)}
            >
              {isLoading ? (
                <Skeleton className="h-3 w-12" />
              ) : (
                `${tokenBalance.balance.toFixed(2)} ${tokenBalance.token}`
              )}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
};
