// @/store/preferences/currencyStore.ts

import { currencyOptions } from '@/constants/currencyData';
import { create } from 'zustand';

type CurrencyState = {
  currency: string;
  setCurrency: (currency: string) => void;
};

export const useCurrencyStore = create<CurrencyState>((set) => ({
  currency: 'USD',
  setCurrency: (currency: string) => {
    if (currencyOptions.includes(currency)) {
      set({ currency });
    }
  },
}));
