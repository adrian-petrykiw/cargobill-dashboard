// @/hooks/useCurrencyExchangeRate.ts
import { useQuery } from '@tanstack/react-query';
import { AnyCurrencyCode } from '@/types/currency';

interface RateResponse {
  rate: number | null;
  path: AnyCurrencyCode[];
  timestamp: number;
  isDirectRate: boolean;
}

/**
 * Fetch a specific exchange rate from the API
 */
const fetchExchangeRate = async (
  from: AnyCurrencyCode,
  to: AnyCurrencyCode,
  findBest: boolean = true,
): Promise<RateResponse> => {
  const response = await fetch(
    `/api/exchange-rate?from=${from}&to=${to}&findBest=${findBest ? 'true' : 'false'}`,
  );

  if (!response.ok) {
    throw new Error('Failed to fetch exchange rate');
  }

  return response.json();
};

/**
 * Hook to get the exchange rate between two currencies
 */
export function useCurrencyExchangeRate(
  from: AnyCurrencyCode,
  to: AnyCurrencyCode,
  findBest: boolean = true,
) {
  return useQuery({
    queryKey: ['exchangeRate', from, to, findBest],
    queryFn: () => fetchExchangeRate(from, to, findBest),
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    enabled: from !== undefined && to !== undefined && from !== to,
  });
}
