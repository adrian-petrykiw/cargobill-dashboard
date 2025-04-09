// pages/api/exchange-rate.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import {
  usdExchangeRates,
  eurExchangeRates,
  directStablecoinPairs,
  directFiatPairs,
  stablecoinPairs,
} from '@/constants/exchangeRateData';
import { AnyCurrencyCode } from '@/types/currency';

interface RateResponse {
  rate: number | null;
  path: AnyCurrencyCode[];
  timestamp: number;
  isDirectRate: boolean;
}

interface ErrorResponse {
  error: string;
}

/**
 * Get the rate for a specific currency pair
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RateResponse | ErrorResponse>,
) {
  const { from, to, findBest } = req.query;

  if (!from || !to || typeof from !== 'string' || typeof to !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid from/to parameters' });
  }

  // Add artificial delay to simulate API call
  await new Promise((resolve) => setTimeout(resolve, 200));

  try {
    // Determine if we should find the best rate or just a direct rate
    const useBestRate = findBest === 'true' || findBest === '1';

    let result;
    if (useBestRate) {
      // Find the best conversion path and rate
      result = findBestRate(from as AnyCurrencyCode, to as AnyCurrencyCode);

      res.status(200).json({
        rate: result.rate,
        path: result.path,
        timestamp: Date.now(),
        isDirectRate: result.path.length <= 2, // Direct if only from → to
      });
    } else {
      // Just get the direct rate if available
      const directRate = findRate(from as AnyCurrencyCode, to as AnyCurrencyCode);

      res.status(200).json({
        rate: typeof directRate === 'number' ? directRate : null,
        path: directRate !== '-' ? [from as AnyCurrencyCode, to as AnyCurrencyCode] : [],
        timestamp: Date.now(),
        isDirectRate: true,
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to find exchange rate' });
  }
}

/**
 * Find the direct conversion rate between two currencies if available.
 * Returns a special value if the rate isn't directly available.
 */
function findRate(from: AnyCurrencyCode, to: AnyCurrencyCode): number | string {
  // Same currency
  if (from === to) {
    return 1;
  }

  // Check stablecoin to stablecoin
  if (isStablecoin(from) && isStablecoin(to)) {
    const pairKey = `${from}_${to}`;
    return stablecoinPairs[pairKey] || '-';
  }

  // Check fiat to stablecoin
  if (!isStablecoin(from) && isStablecoin(to)) {
    const pair = directStablecoinPairs.find((p) => p.fiat === from && p.stablecoin === to);
    return pair ? pair.buyRate : '-';
  }

  // Check stablecoin to fiat
  if (isStablecoin(from) && !isStablecoin(to)) {
    const pair = directStablecoinPairs.find((p) => p.stablecoin === from && p.fiat === to);
    return pair ? pair.sellRate : '-';
  }

  // Check direct fiat to fiat
  if (!isStablecoin(from) && !isStablecoin(to)) {
    // Forward direction
    const directPair = directFiatPairs.find((p) => p.fromFiat === from && p.toFiat === to);

    if (directPair) {
      return directPair.buyRate;
    }

    // Reverse direction
    const reversePair = directFiatPairs.find((p) => p.fromFiat === to && p.toFiat === from);

    if (reversePair) {
      return 1 / reversePair.sellRate;
    }
  }

  // No direct rate available
  return '-';
}

/**
 * Find the best available rate between two currencies
 * This simulates what would happen in the actual API
 */
function findBestRate(
  from: AnyCurrencyCode,
  to: AnyCurrencyCode,
): { rate: number; path: AnyCurrencyCode[] } {
  // If same currency, return 1:1 rate
  if (from === to) {
    return { rate: 1, path: [from] };
  }

  // Check for direct stablecoin pairs
  if (isStablecoin(from) && isStablecoin(to)) {
    const pairKey = `${from}_${to}`;
    if (stablecoinPairs[pairKey]) {
      return {
        rate: stablecoinPairs[pairKey],
        path: [from, to],
      };
    }
  }

  // Check for direct fiat-to-stablecoin pairs
  if (!isStablecoin(from) && isStablecoin(to)) {
    const pair = directStablecoinPairs.find((p) => p.fiat === from && p.stablecoin === to);
    if (pair) {
      return { rate: pair.buyRate, path: [from, to] };
    }
  }

  // Check for direct stablecoin-to-fiat pairs
  if (isStablecoin(from) && !isStablecoin(to)) {
    const pair = directStablecoinPairs.find((p) => p.stablecoin === from && p.fiat === to);
    if (pair) {
      return { rate: pair.sellRate, path: [from, to] };
    }
  }

  // Check for direct fiat-to-fiat pairs
  if (!isStablecoin(from) && !isStablecoin(to)) {
    const directPair = directFiatPairs.find((p) => p.fromFiat === from && p.toFiat === to);
    if (directPair) {
      return { rate: directPair.buyRate, path: [from, to] };
    }

    // Check reverse pair
    const reversePair = directFiatPairs.find((p) => p.fromFiat === to && p.toFiat === from);
    if (reversePair) {
      return { rate: 1 / reversePair.sellRate, path: [from, to] };
    }
  }

  // Try via USD
  if (usdExchangeRates[from] && usdExchangeRates[to]) {
    const fromRate = from === 'USD' ? 1 : 1 / usdExchangeRates[from];
    const toRate = to === 'USD' ? 1 : usdExchangeRates[to];
    return {
      rate: fromRate * toRate,
      path: [from, 'USD', to],
    };
  }

  // Try via EUR
  if (eurExchangeRates[from] && eurExchangeRates[to]) {
    const fromRate = from === 'EUR' ? 1 : 1 / eurExchangeRates[from];
    const toRate = to === 'EUR' ? 1 : eurExchangeRates[to];
    return {
      rate: fromRate * toRate,
      path: [from, 'EUR', to],
    };
  }

  // If no direct path, fallback to USD route with calculated rates
  return {
    rate: (1 / (usdExchangeRates[from] || 1)) * (usdExchangeRates[to] || 1),
    path: [from, 'USD', to],
  };
}

function isStablecoin(code: string): boolean {
  return ['USDC', 'USDT', 'EURC'].includes(code);
}
