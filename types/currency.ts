// types/currency.ts
import { currencyOptions } from '@/constants/currencyData';

// Type definitions
export type CurrencyCode = (typeof currencyOptions)[number];
export type StablecoinCode = 'USDC' | 'USDT' | 'EURC';
export type AnyCurrencyCode = CurrencyCode | StablecoinCode;

// Interface for direct fiat-stablecoin pairs
export interface DirectStablecoinPair {
  fiat: CurrencyCode;
  stablecoin: StablecoinCode;
  buyRate: number; // 1 fiat = X stablecoin
  sellRate: number; // 1 stablecoin = X fiat
}

// Interface for direct fiat-to-fiat pairs
export interface DirectFiatPair {
  fromFiat: CurrencyCode;
  toFiat: CurrencyCode;
  buyRate: number; // 1 fromFiat = X toFiat
  sellRate: number; // 1 toFiat = X fromFiat
}

// API response type for exchange rates
export interface ExchangeRatesResponse {
  usdRates: Record<string, number>;
  eurRates: Record<string, number>;
  stablecoinPairs: Record<string, number>;
  directStablecoinPairs: DirectStablecoinPair[];
  directFiatPairs: DirectFiatPair[];
  timestamp: number; // Unix timestamp of when rates were fetched
}

// Conversion result
export interface ConversionResult {
  amount: number;
  path: AnyCurrencyCode[];
  rate: number;
}
