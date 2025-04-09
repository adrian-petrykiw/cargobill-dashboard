// @/hooks/useCurrency.ts
import { useCallback } from 'react';
import { useCurrencyStore } from '@/store/preferences/currencyStore';
import { useCurrencyExchangeRate } from '@/hooks/useCurrencyExchangeRate';
import { AnyCurrencyCode } from '@/types/currency';

export function useCurrency() {
  const { currency, setCurrency } = useCurrencyStore();

  // Get USD to selected currency rate
  const usdToSelectedRate = useCurrencyExchangeRate(
    'USD' as AnyCurrencyCode,
    currency as AnyCurrencyCode,
  );

  // Get selected currency to USD rate
  const selectedToUsdRate = useCurrencyExchangeRate(
    currency as AnyCurrencyCode,
    'USD' as AnyCurrencyCode,
  );

  // Format a number as currency with the specified currency code
  const formatCurrency = useCallback(
    (amount: number, currencyCode: string = currency): string => {
      // Handle stablecoins differently
      if (isStablecoin(currencyCode)) {
        return `${amount.toFixed(2)} ${currencyCode}`;
      }

      // Format regular fiat currencies
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    },
    [currency],
  );

  // Convert an amount from USD to the selected currency
  const convertFromUSD = useCallback(
    (amountInUSD: number): number => {
      const rate = usdToSelectedRate.data?.rate ?? 1;
      return amountInUSD * (typeof rate === 'number' ? rate : 1);
    },
    [usdToSelectedRate.data?.rate],
  );

  // Convert an amount from the selected currency to USD
  const convertToUSD = useCallback(
    (amountInSelectedCurrency: number): number => {
      const rate = selectedToUsdRate.data?.rate ?? 1;
      return amountInSelectedCurrency * (typeof rate === 'number' ? rate : 1);
    },
    [selectedToUsdRate.data?.rate],
  );

  // Convert from one currency to another
  const convert = useCallback(
    (
      amount: number,
      from: AnyCurrencyCode,
      to: AnyCurrencyCode = currency as AnyCurrencyCode,
    ): number => {
      // Direct conversion if from and to are the same
      if (from === to) return amount;

      // For common conversions, use cached rates
      if (from === 'USD' && to === currency) {
        return convertFromUSD(amount);
      }

      if (from === currency && to === 'USD') {
        return convertToUSD(amount);
      }

      // For other conversions, convert via USD
      // This is a simplification - in a real app, you might want to use the API
      // to get the optimal conversion path
      if (from !== 'USD' && to !== 'USD') {
        const amountInUsd = convertToUSD(amount); // This assumes convertToUSD works for any currency
        return convertFromUSD(amountInUsd); // This assumes convertFromUSD works for any currency
      }

      // Fallback for other cases
      return amount;
    },
    [currency, convertFromUSD, convertToUSD],
  );

  // Format and convert in one step
  const formatConverted = useCallback(
    (
      amount: number,
      from: AnyCurrencyCode,
      to: AnyCurrencyCode = currency as AnyCurrencyCode,
    ): string => {
      const convertedAmount = convert(amount, from, to);
      return formatCurrency(convertedAmount, to);
    },
    [convert, formatCurrency, currency],
  );

  return {
    currency,
    setCurrency,
    formatCurrency,
    convertFromUSD,
    convertToUSD,
    convert,
    formatConverted,
    isLoading: usdToSelectedRate.isLoading || selectedToUsdRate.isLoading,
  };
}

// Helper function
function isStablecoin(code: string): boolean {
  return ['USDC', 'USDT', 'EURC'].includes(code);
}
