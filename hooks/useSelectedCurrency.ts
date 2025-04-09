// @/hooks/useSelectedCurrency.ts

import { useCurrencyStore } from '@/store/preferences/currencyStore';

// Mock exchange rates (in a real app, you'd fetch these from an API)
const exchangeRates: Record<string, number> = {
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

export function useCurrency() {
  const { currency, setCurrency } = useCurrencyStore();

  /**
   * Convert an amount from USD to the selected currency
   */
  const convertFromUSD = (amountInUSD: number): number => {
    const rate = exchangeRates[currency] || 1;
    return amountInUSD * rate;
  };

  /**
   * Convert an amount from the selected currency to USD
   */
  const convertToUSD = (amountInSelectedCurrency: number): number => {
    const rate = exchangeRates[currency] || 1;
    return amountInSelectedCurrency / rate;
  };

  /**
   * Format a number as currency with the selected currency symbol
   */
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return {
    currency,
    setCurrency,
    convertFromUSD,
    convertToUSD,
    formatCurrency,
  };
}
