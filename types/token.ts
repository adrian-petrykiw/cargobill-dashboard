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

export type SwapSimulationResult = {
  fromToken: TokenType;
  toToken: TokenType;
  amountIn: number;
  estimatedAmountOut: number;
  minimumAmountOut: number;
  priceImpact: number;
  exchangeRate: number;
  fees: {
    protocolFee: number;
    networkFee: number;
    totalFee: number;
  };
  route: 'perena' | 'jupiter';
  routeDetails: {
    provider: string;
    pools?: string[];
    priceImpactWarning?: boolean;
  };
  estimatedExecutionTime: string;
  simulationId: string;
};
