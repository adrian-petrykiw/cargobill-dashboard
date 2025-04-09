// constants/exchangeRateData.ts
import { DirectFiatPair, DirectStablecoinPair } from '@/types/currency';

/**
 * Exchange rates relative to USD (1 USD = X units of currency)
 */
export const usdExchangeRates: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.78,
  CAD: 1.37,
  INR: 83.51,
  AED: 3.67,
  THB: 35.72,
  VND: 24850,
  MYR: 4.71,
  HKD: 7.82,
  SGD: 1.35,
  JPY: 151.69,
  SAR: 3.75,
  QAR: 3.64,
  NGN: 1390,
  CNY: 7.24,
  PKR: 278.25,
};

/**
 * Exchange rates relative to EUR (1 EUR = X units of currency)
 * Complete set with all currencies
 */
export const eurExchangeRates: Record<string, number> = {
  EUR: 1,
  USD: 1.087,
  GBP: 0.847,
  CAD: 1.489,
  INR: 90.77,
  AED: 3.99,
  THB: 38.83,
  VND: 27014.75,
  MYR: 5.12,
  HKD: 8.5,
  SGD: 1.47,
  JPY: 164.89,
  SAR: 4.08,
  QAR: 3.96,
  NGN: 1511.3,
  CNY: 7.87,
  PKR: 302.43,
};

/**
 * Direct fiat-to-fiat conversion pairs with buy/sell rates
 * Comprehensive set of commonly traded direct pairs
 */
export const directFiatPairs: DirectFiatPair[] = [
  // Southeast Asia pairs
  {
    fromFiat: 'SGD',
    toFiat: 'MYR',
    buyRate: 3.49,
    sellRate: 0.285,
  },
  {
    fromFiat: 'SGD',
    toFiat: 'THB',
    buyRate: 26.46,
    sellRate: 0.0377,
  },
  {
    fromFiat: 'SGD',
    toFiat: 'INR',
    buyRate: 61.86,
    sellRate: 0.0161,
  },
  {
    fromFiat: 'THB',
    toFiat: 'VND',
    buyRate: 695.13,
    sellRate: 0.00144,
  },
  {
    fromFiat: 'MYR',
    toFiat: 'THB',
    buyRate: 7.58,
    sellRate: 0.131,
  },
  {
    fromFiat: 'MYR',
    toFiat: 'VND',
    buyRate: 5276.01,
    sellRate: 0.00019,
  },
  {
    fromFiat: 'SGD',
    toFiat: 'VND',
    buyRate: 18407.41,
    sellRate: 0.000054,
  },

  // European pairs
  {
    fromFiat: 'GBP',
    toFiat: 'EUR',
    buyRate: 1.18,
    sellRate: 0.847,
  },
  {
    fromFiat: 'EUR',
    toFiat: 'GBP',
    buyRate: 0.847,
    sellRate: 1.18,
  },
  {
    fromFiat: 'EUR',
    toFiat: 'CHE',
    buyRate: 0.956,
    sellRate: 1.046,
  },

  // North American pairs
  {
    fromFiat: 'USD',
    toFiat: 'CAD',
    buyRate: 1.37,
    sellRate: 0.73,
  },
  {
    fromFiat: 'CAD',
    toFiat: 'USD',
    buyRate: 0.73,
    sellRate: 1.37,
  },
  {
    fromFiat: 'USD',
    toFiat: 'MXN',
    buyRate: 16.75,
    sellRate: 0.0597,
  },

  // Middle East pairs
  {
    fromFiat: 'AED',
    toFiat: 'SAR',
    buyRate: 1.021,
    sellRate: 0.979,
  },
  {
    fromFiat: 'SAR',
    toFiat: 'QAR',
    buyRate: 0.97,
    sellRate: 1.03,
  },
  {
    fromFiat: 'SAR',
    toFiat: 'AED',
    buyRate: 0.979,
    sellRate: 1.021,
  },

  // Additional Asian pairs
  {
    fromFiat: 'JPY',
    toFiat: 'KRW',
    buyRate: 8.73,
    sellRate: 0.114,
  },
  {
    fromFiat: 'CNY',
    toFiat: 'HKD',
    buyRate: 1.08,
    sellRate: 0.926,
  },
  {
    fromFiat: 'HKD',
    toFiat: 'SGD',
    buyRate: 0.173,
    sellRate: 5.79,
  },
  {
    fromFiat: 'INR',
    toFiat: 'NPR',
    buyRate: 1.6,
    sellRate: 0.625,
  },
  {
    fromFiat: 'PKR',
    toFiat: 'INR',
    buyRate: 0.3,
    sellRate: 3.33,
  },
];

/**
 * Direct stablecoin pairs with local fiat currencies
 * Comprehensive set of stablecoin-fiat swaps across regions
 */
export const directStablecoinPairs: DirectStablecoinPair[] = [
  // Southeast Asia
  // Vietnam
  {
    fiat: 'VND',
    stablecoin: 'USDC',
    buyRate: 0.00004,
    sellRate: 24900,
  },
  {
    fiat: 'VND',
    stablecoin: 'USDT',
    buyRate: 0.00004,
    sellRate: 24920,
  },
  {
    fiat: 'VND',
    stablecoin: 'EURC',
    buyRate: 0.000037,
    sellRate: 27100,
  },

  // Thailand
  {
    fiat: 'THB',
    stablecoin: 'USDC',
    buyRate: 0.028,
    sellRate: 35.9,
  },
  {
    fiat: 'THB',
    stablecoin: 'USDT',
    buyRate: 0.028,
    sellRate: 36.0,
  },
  {
    fiat: 'THB',
    stablecoin: 'EURC',
    buyRate: 0.026,
    sellRate: 39.1,
  },

  // Malaysia
  {
    fiat: 'MYR',
    stablecoin: 'USDC',
    buyRate: 0.213,
    sellRate: 4.73,
  },
  {
    fiat: 'MYR',
    stablecoin: 'USDT',
    buyRate: 0.212,
    sellRate: 4.75,
  },
  {
    fiat: 'MYR',
    stablecoin: 'EURC',
    buyRate: 0.195,
    sellRate: 5.15,
  },

  // Singapore
  {
    fiat: 'SGD',
    stablecoin: 'USDC',
    buyRate: 0.741,
    sellRate: 1.353,
  },
  {
    fiat: 'SGD',
    stablecoin: 'USDT',
    buyRate: 0.745,
    sellRate: 1.345,
  },
  {
    fiat: 'SGD',
    stablecoin: 'EURC',
    buyRate: 0.682,
    sellRate: 1.47,
  },

  // India
  {
    fiat: 'INR',
    stablecoin: 'USDC',
    buyRate: 0.012,
    sellRate: 83.6,
  },
  {
    fiat: 'INR',
    stablecoin: 'USDT',
    buyRate: 0.0119,
    sellRate: 84.0,
  },
  {
    fiat: 'INR',
    stablecoin: 'EURC',
    buyRate: 0.011,
    sellRate: 91.0,
  },

  // Middle East
  // UAE
  {
    fiat: 'AED',
    stablecoin: 'USDC',
    buyRate: 0.272,
    sellRate: 3.68,
  },
  {
    fiat: 'AED',
    stablecoin: 'USDT',
    buyRate: 0.271,
    sellRate: 3.69,
  },
  {
    fiat: 'AED',
    stablecoin: 'EURC',
    buyRate: 0.25,
    sellRate: 4.0,
  },

  // Saudi Arabia
  {
    fiat: 'SAR',
    stablecoin: 'USDC',
    buyRate: 0.266,
    sellRate: 3.76,
  },
  {
    fiat: 'SAR',
    stablecoin: 'USDT',
    buyRate: 0.265,
    sellRate: 3.77,
  },
  {
    fiat: 'SAR',
    stablecoin: 'EURC',
    buyRate: 0.244,
    sellRate: 4.1,
  },

  // Africa
  // Nigeria
  {
    fiat: 'NGN',
    stablecoin: 'USDC',
    buyRate: 0.00072,
    sellRate: 1395,
  },
  {
    fiat: 'NGN',
    stablecoin: 'USDT',
    buyRate: 0.00071,
    sellRate: 1410,
  },
  {
    fiat: 'NGN',
    stablecoin: 'EURC',
    buyRate: 0.00066,
    sellRate: 1520,
  },

  // Europe
  // UK
  {
    fiat: 'GBP',
    stablecoin: 'USDC',
    buyRate: 1.282,
    sellRate: 0.779,
  },
  {
    fiat: 'GBP',
    stablecoin: 'USDT',
    buyRate: 1.281,
    sellRate: 0.78,
  },
  {
    fiat: 'GBP',
    stablecoin: 'EURC',
    buyRate: 1.18,
    sellRate: 0.847,
  },

  // Euro
  {
    fiat: 'EUR',
    stablecoin: 'USDC',
    buyRate: 1.087,
    sellRate: 0.92,
  },
  {
    fiat: 'EUR',
    stablecoin: 'USDT',
    buyRate: 1.086,
    sellRate: 0.921,
  },
  {
    fiat: 'EUR',
    stablecoin: 'EURC',
    buyRate: 0.998,
    sellRate: 1.002,
  },

  // North America
  // Canada
  {
    fiat: 'CAD',
    stablecoin: 'USDC',
    buyRate: 0.73,
    sellRate: 1.37,
  },
  {
    fiat: 'CAD',
    stablecoin: 'USDT',
    buyRate: 0.729,
    sellRate: 1.372,
  },
  {
    fiat: 'CAD',
    stablecoin: 'EURC',
    buyRate: 0.67,
    sellRate: 1.49,
  },

  // East Asia
  // China
  {
    fiat: 'CNY',
    stablecoin: 'USDC',
    buyRate: 0.138,
    sellRate: 7.25,
  },
  {
    fiat: 'CNY',
    stablecoin: 'USDT',
    buyRate: 0.137,
    sellRate: 7.3,
  },
  {
    fiat: 'CNY',
    stablecoin: 'EURC',
    buyRate: 0.126,
    sellRate: 7.94,
  },

  // Hong Kong
  {
    fiat: 'HKD',
    stablecoin: 'USDC',
    buyRate: 0.128,
    sellRate: 7.83,
  },
  {
    fiat: 'HKD',
    stablecoin: 'USDT',
    buyRate: 0.127,
    sellRate: 7.87,
  },
  {
    fiat: 'HKD',
    stablecoin: 'EURC',
    buyRate: 0.117,
    sellRate: 8.55,
  },

  // Japan
  {
    fiat: 'JPY',
    stablecoin: 'USDC',
    buyRate: 0.0066,
    sellRate: 151.5,
  },
  {
    fiat: 'JPY',
    stablecoin: 'USDT',
    buyRate: 0.00658,
    sellRate: 152.0,
  },
  {
    fiat: 'JPY',
    stablecoin: 'EURC',
    buyRate: 0.00606,
    sellRate: 165.0,
  },
];

// Stablecoin to stablecoin conversion rates (1 source = X target)
export const stablecoinPairs: Record<string, number> = {
  USDC_USDT: 0.999, // 1 USDC = 0.999 USDT
  USDT_USDC: 0.998, // 1 USDT = 0.998 USDC
  USDC_EURC: 0.92, // 1 USDC = 0.92 EURC
  EURC_USDC: 1.085, // 1 EURC = 1.085 USDC
  USDT_EURC: 0.919, // 1 USDT = 0.919 EURC
  EURC_USDT: 1.083, // 1 EURC = 1.083 USDT
};
