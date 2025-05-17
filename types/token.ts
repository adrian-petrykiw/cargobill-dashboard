export type TokenType = 'USDC' | 'USDT' | 'EURC';

export type TokenBalance = {
  token: TokenType;
  balance: number;
  ata: string | null;
};
