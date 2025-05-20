// types/token.ts
import { PublicKey } from '@solana/web3.js';

export type TokenType = 'USDC' | 'USDT' | 'EURC' | 'SOL';

export interface TokenInfo {
  mint: PublicKey | null;
  name: string;
  symbol: string;
  decimals: number;
}

export interface TokenBalance {
  token: TokenType;
  balance: number;
  ata: string | null;
}
