// lib/currency.ts

import {
  AnyCurrencyCode,
  ConversionResult,
  CurrencyCode,
  DirectFiatPair,
  DirectStablecoinPair,
  StablecoinCode,
} from '@/types/currency';

// State variables to hold current rates (will be updated by fetchExchangeRates)
let usdExchangeRates: Record<string, number> = {};
let eurExchangeRates: Record<string, number> = {};
let directStablecoinPairs: DirectStablecoinPair[] = [];
let directFiatPairs: DirectFiatPair[] = [];
let stablecoinPairs: Record<string, number> = {};
let lastUpdated = 0;

/**
 * Initialize rates with default values - typically called early in app lifecycle
 * or when rates are fetched for the first time
 */
export const initializeRates = (
  usdRates: Record<string, number>,
  eurRates: Record<string, number>,
  stablePairs: Record<string, number>,
  stablecoinFiatPairs: DirectStablecoinPair[],
  fiatPairs: DirectFiatPair[],
  timestamp = Date.now(),
): void => {
  usdExchangeRates = { ...usdRates };
  eurExchangeRates = { ...eurRates };
  stablecoinPairs = { ...stablePairs };
  directStablecoinPairs = [...stablecoinFiatPairs];
  directFiatPairs = [...fiatPairs];
  lastUpdated = timestamp;
};

/**
 * Check if a code is a stablecoin
 */
export const isStablecoin = (code: string): boolean => {
  return ['USDC', 'USDT', 'EURC'].includes(code);
};

/**
 * Get the direct fiat-to-fiat pair if available
 */
export const getDirectFiatRate = (from: CurrencyCode, to: CurrencyCode): number | undefined => {
  // Find a direct pair
  const directPair = directFiatPairs.find((p) => p.fromFiat === from && p.toFiat === to);

  if (directPair) {
    return directPair.buyRate;
  }

  // Check for the reverse pair (using sell rate)
  const reversePair = directFiatPairs.find((p) => p.fromFiat === to && p.toFiat === from);

  if (reversePair) {
    return 1 / reversePair.sellRate;
  }

  return undefined;
};

/**
 * Get the direct stablecoin-fiat pair rate if available
 */
export const getDirectStablecoinRate = (
  from: AnyCurrencyCode,
  to: AnyCurrencyCode,
): number | undefined => {
  // Check if this is a stablecoin to stablecoin conversion
  if (isStablecoin(from) && isStablecoin(to)) {
    const pairKey = `${from}_${to}`;
    return stablecoinPairs[pairKey];
  }

  // Check if this is a fiat to stablecoin conversion
  if (!isStablecoin(from) && isStablecoin(to)) {
    // We're buying stablecoin with fiat
    const pair = directStablecoinPairs.find((p) => p.fiat === from && p.stablecoin === to);
    return pair ? pair.buyRate : undefined;
  }

  // Check if this is a stablecoin to fiat conversion
  if (isStablecoin(from) && !isStablecoin(to)) {
    // We're selling stablecoin for fiat
    const pair = directStablecoinPairs.find((p) => p.stablecoin === from && p.fiat === to);
    return pair ? pair.sellRate : undefined;
  }

  return undefined;
};

/**
 * Convert using the direct path if available
 */
export const convertDirect = (
  amount: number,
  from: AnyCurrencyCode,
  to: AnyCurrencyCode,
): ConversionResult | undefined => {
  if (from === to) {
    return { amount, path: [from], rate: 1 };
  }

  // Try stablecoin direct path
  const stablecoinRate = getDirectStablecoinRate(from, to);
  if (stablecoinRate !== undefined) {
    return {
      amount: amount * stablecoinRate,
      path: [from, to],
      rate: stablecoinRate,
    };
  }

  // Try fiat-to-fiat direct path
  if (!isStablecoin(from) && !isStablecoin(to)) {
    const fiatRate = getDirectFiatRate(from as CurrencyCode, to as CurrencyCode);
    if (fiatRate !== undefined) {
      return {
        amount: amount * fiatRate,
        path: [from, to],
        rate: fiatRate,
      };
    }
  }

  return undefined;
};

/**
 * Convert through USD or EUR as intermediary
 */
export const convertThroughFiat = (
  amount: number,
  from: AnyCurrencyCode,
  to: AnyCurrencyCode,
): ConversionResult => {
  // Try USD path
  let usdAmount: number;
  if (from === 'USD') {
    usdAmount = amount;
  } else if (isStablecoin(from) && (from === 'USDC' || from === 'USDT')) {
    // Assume stablecoins close to 1:1 with their fiat
    usdAmount = amount;
  } else {
    // Convert to USD
    usdAmount = amount / usdExchangeRates[from];
  }

  // Convert from USD to target
  let resultAmount: number;
  if (to === 'USD') {
    resultAmount = usdAmount;
  } else if (isStablecoin(to) && (to === 'USDC' || to === 'USDT')) {
    // Assume stablecoins close to 1:1 with their fiat
    resultAmount = usdAmount;
  } else {
    resultAmount = usdAmount * usdExchangeRates[to];
  }

  const usdRate = resultAmount / amount;

  // Try EUR path
  let eurAmount: number;
  if (from === 'EUR') {
    eurAmount = amount;
  } else if (from === 'EURC') {
    // EURC close to 1:1 with EUR
    eurAmount = amount;
  } else if (eurExchangeRates[from]) {
    // Convert directly to EUR if we have the rate
    eurAmount = amount / eurExchangeRates[from];
  } else {
    // Go through USD to EUR
    eurAmount = usdAmount * eurExchangeRates.USD;
  }

  // Convert from EUR to target
  let eurResultAmount: number;
  if (to === 'EUR') {
    eurResultAmount = eurAmount;
  } else if (to === 'EURC') {
    // EURC close to 1:1 with EUR
    eurResultAmount = eurAmount;
  } else if (eurExchangeRates[to]) {
    // Convert directly from EUR if we have the rate
    eurResultAmount = eurAmount * eurExchangeRates[to];
  } else {
    // Go through EUR to USD to target
    const usdViaEur = eurAmount / eurExchangeRates.USD;
    eurResultAmount = usdViaEur * usdExchangeRates[to];
  }

  const eurRate = eurResultAmount / amount;

  // Return the better of USD or EUR paths
  if (eurRate > usdRate) {
    return {
      amount: eurResultAmount,
      path: [from, 'EUR', to],
      rate: eurRate,
    };
  } else {
    return {
      amount: resultAmount,
      path: [from, 'USD', to],
      rate: usdRate,
    };
  }
};

/**
 * Find the best conversion path between multiple stablecoins if available
 */
export const findBestStablecoinPath = (
  amount: number,
  from: AnyCurrencyCode,
  to: AnyCurrencyCode,
  currentBest: ConversionResult,
): ConversionResult => {
  if (!isStablecoin(from) && !isStablecoin(to)) {
    return currentBest; // Not stablecoin conversion
  }

  let bestPath = currentBest;
  const stablecoins: StablecoinCode[] = ['USDC', 'USDT', 'EURC'];

  // Check paths through each stablecoin
  for (const stablecoin of stablecoins) {
    if (stablecoin !== from && stablecoin !== to) {
      const toStable = convertDirect(amount, from, stablecoin);
      if (toStable) {
        const fromStable = convertDirect(toStable.amount, stablecoin, to);
        if (fromStable) {
          const totalRate = fromStable.amount / amount;
          if (totalRate > bestPath.rate) {
            bestPath = {
              amount: fromStable.amount,
              path: [from, stablecoin, to],
              rate: totalRate,
            };
          }
        }
      }
    }
  }

  return bestPath;
};

/**
 * Convert an amount from one currency/stablecoin to another using the best available path
 * @param amount Amount to convert
 * @param from Source currency or stablecoin
 * @param to Target currency or stablecoin
 * @returns Converted amount and the path taken
 */
export const convertCurrency = (
  amount: number,
  from: AnyCurrencyCode,
  to: AnyCurrencyCode,
): ConversionResult => {
  // If same currency, no conversion needed
  if (from === to) {
    return { amount, path: [from], rate: 1 };
  }

  // Try direct conversion first
  const directResult = convertDirect(amount, from, to);
  if (directResult) {
    return directResult;
  }

  // If direct path not available, try through fiat currencies
  const fiatResult = convertThroughFiat(amount, from, to);

  // Finally, check if there's a special path through a different stablecoin
  // that might be better than the fiat path
  if (isStablecoin(from) || isStablecoin(to)) {
    return findBestStablecoinPath(amount, from, to, fiatResult);
  }

  return fiatResult;
};

/**
 * Formats a number as currency with the specified currency code
 * @param amount The amount to format
 * @param currency The currency code to use for formatting
 * @param locale The locale to use for formatting
 * @returns Formatted currency string
 */
export const formatCurrency = (
  amount: number,
  currency: CurrencyCode = 'USD',
  locale = 'en-US',
): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Formats a crypto/stablecoin amount
 * @param amount The amount to format
 * @param token The token symbol (USDC, USDT, EURC, etc.)
 * @param decimals The number of decimal places to show
 * @returns Formatted crypto amount string
 */
export const formatStablecoin = (
  amount: number,
  token: StablecoinCode = 'USDC',
  decimals = 2,
): string => {
  return `${amount.toFixed(decimals)} ${token}`;
};

/**
 * Format and convert an amount from one currency to another
 * @param amount The amount to convert and format
 * @param from Source currency code
 * @param to Target currency code
 * @param locale Locale for formatting
 * @returns Formatted currency string in the target currency
 */
export const formatConvertedCurrency = (
  amount: number,
  from: AnyCurrencyCode,
  to: AnyCurrencyCode,
  locale = 'en-US',
): string => {
  const result = convertCurrency(amount, from, to);

  // Format differently based on whether it's a fiat currency or stablecoin
  if (isStablecoin(to)) {
    return formatStablecoin(result.amount, to as StablecoinCode);
  } else {
    return formatCurrency(result.amount, to as CurrencyCode, locale);
  }
};

/**
 * Get the currency symbol for a given currency code
 * @param currencyCode The currency code
 * @returns The currency symbol
 */
export const getCurrencySymbol = (currencyCode: CurrencyCode, locale = 'en-US'): string => {
  return (
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
    })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value || currencyCode
  );
};

/**
 * Check if a currency code is valid
 */
export const isValidCurrency = (code: string): boolean => {
  return code in usdExchangeRates || isStablecoin(code);
};

/**
 * Get the timestamp of the last rates update
 */
export const getLastUpdated = (): number => {
  return lastUpdated;
};
