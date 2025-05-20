// constants/solana.ts
import { PublicKey } from '@solana/web3.js';

export const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
export const USDT_MINT = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');
export const EURC_MINT = new PublicKey('HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr');

export const TOKENS = {
  USDC: {
    mint: USDC_MINT,
    name: 'USDC',
    symbol: 'USDC',
    decimals: 6,
  },
  USDT: {
    mint: USDT_MINT,
    name: 'USDT',
    symbol: 'USDT',
    decimals: 6,
  },
  EURC: {
    mint: EURC_MINT,
    name: 'EURC',
    symbol: 'EURC',
    decimals: 6,
  },
  SOL: {
    mint: null, // Native SOL doesn't have a mint address - handled differently
    name: 'SOL',
    symbol: 'SOL',
    decimals: 9,
  },
};

// Helper function to get stablecoins (all SPL tokens except SOL)
export const STABLECOINS = Object.fromEntries(
  Object.entries(TOKENS).filter(([key]) => key !== 'SOL'),
) as { [K in keyof typeof TOKENS as K extends 'SOL' ? never : K]: (typeof TOKENS)[K] };

export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
);

export const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
