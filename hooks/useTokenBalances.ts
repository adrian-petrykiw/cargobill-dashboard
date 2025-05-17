// hooks/useTokenBalances.ts
import { useQuery } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import { tokenBalanceService } from '@/services/blockchain/tokenBalance';
import { TokenBalance, TokenType } from '@/types/token';
import { TOKENS } from '@/constants/solana';

// This now takes a multisigPda directly
export function useTokenBalances(multisigPda: PublicKey | null) {
  return useQuery({
    queryKey: ['tokenBalances', multisigPda?.toBase58()],
    queryFn: async () => {
      if (!multisigPda) {
        return [];
      }

      return tokenBalanceService.getAllTokenBalances(multisigPda);
    },
    enabled: !!multisigPda,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

// This now takes a multisigPda directly
export function useTokenBalance(multisigPda: PublicKey | null, tokenType: TokenType) {
  return useQuery({
    queryKey: ['tokenBalance', multisigPda?.toBase58(), tokenType],
    queryFn: async () => {
      if (!multisigPda) {
        return null;
      }

      const tokenInfo = TOKENS[tokenType];
      return tokenBalanceService.getTokenBalance(multisigPda, tokenInfo.mint, tokenType);
    },
    enabled: !!multisigPda,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: false,
    retry: 2,
  });
}
