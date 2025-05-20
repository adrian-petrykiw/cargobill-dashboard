// components/features/dashboard/components/BalanceChart.tsx
import React, { useState, useMemo } from 'react';
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
import { STABLECOINS } from '@/constants/solana';

// Type for stablecoin tokens only (excluding SOL)
type StablecoinType = Exclude<TokenType, 'SOL'>;

// Format large numbers to K, M, B format
const formatYAxisValue = (value: number): string => {
  if (value >= 1000000000) {
    return `${(value / 1000000000).toFixed(1)}B`;
  }
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return `${value}`;
};

// Mock data for the chart - this would be replaced with real data
const generateMockData = (balances: TokenBalance[], visibleTokens: StablecoinType[]) => {
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
  // Filter out SOL and only keep stablecoins
  const stablecoinBalances = useMemo(
    () => balances.filter((balance) => Object.keys(STABLECOINS).includes(balance.token)),
    [balances],
  );

  // Initialize with all available stablecoins (excluding SOL)
  const [visibleTokens, setVisibleTokens] = useState<StablecoinType[]>([
    'USDC',
    'USDT',
    'EURC',
  ] as StablecoinType[]);

  const toggleToken = (token: StablecoinType) => {
    setVisibleTokens((prev) => {
      if (prev.includes(token)) {
        // Don't allow removing the last token
        if (prev.length === 1) return prev;
        return prev.filter((t) => t !== token);
      }
      return [...prev, token];
    });
  };

  const chartData = generateMockData(stablecoinBalances, visibleTokens);

  // Colors for tokens
  const tokenColors: Record<StablecoinType, string> = {
    USDC: '#2775CA', // USDC blue
    USDT: '#26A17B', // USDT green
    EURC: '#052D56', // EURC navy blue
  };

  // Get the total balance (stablecoins only)
  const totalBalance = stablecoinBalances
    .filter((balance) => visibleTokens.includes(balance.token as StablecoinType))
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

      {/* Chart container - Reduced height to match cashflow card */}
      {isLoading ? (
        <div className="h-[140px] bg-gray-100 rounded-md">
          <Skeleton className="h-full w-full" />
        </div>
      ) : (
        <div className="h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
              <defs>
                {visibleTokens.map((token) => (
                  <linearGradient
                    key={`gradient-${token}`}
                    id={`color${token}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor={tokenColors[token]} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={tokenColors[token]} stopOpacity={0.2} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 8 }}
                axisLine={false}
                tickLine={false}
                interval={0}
                tickMargin={2}
                minTickGap={2}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatYAxisValue}
                width={28}
                tickMargin={0}
                allowDecimals={false}
              />
              <Tooltip
                formatter={(value) => [`$${Number(value).toFixed(2)}`, '']}
                labelFormatter={(label) => `${label} 2025`}
              />
              {visibleTokens.map((token) => (
                <Area
                  key={token}
                  type="monotone"
                  dataKey={token}
                  stackId="1"
                  stroke={tokenColors[token]}
                  fill={`url(#color${token})`}
                  fillOpacity={0.8}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Token badges - only show stablecoins */}
      <div className="flex justify-between space-x-2 mt-2">
        {stablecoinBalances.map((tokenBalance) => (
          <Badge
            key={tokenBalance.token}
            className={`w-full py-2 rounded-sm hover:cursor-pointer flex justify-center items-center ${
              visibleTokens.includes(tokenBalance.token as StablecoinType)
                ? 'bg-slate-900 text-white hover:bg-slate-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            onClick={() => toggleToken(tokenBalance.token as StablecoinType)}
          >
            {isLoading ? (
              <Skeleton className="h-4 w-16" />
            ) : (
              <span className="font-medium text-xs">
                {tokenBalance.balance.toFixed(2)} {tokenBalance.token}
              </span>
            )}
          </Badge>
        ))}
      </div>
    </div>
  );
};
