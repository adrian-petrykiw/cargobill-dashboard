// services/blockchain/tokenBalance.ts
import { Connection, PublicKey, Commitment } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import * as multisig from '@sqds/multisig';
import { TOKENS } from '@/constants/solana';
import { TokenBalance, TokenType } from '@/types/token';
import { solanaService } from './solana';

export class TokenBalanceService {
  private retryCount = 3;
  private retryDelay = 1000;

  // This method gets balance from the multisig PDA directly now
  async getTokenBalance(
    multisigPda: PublicKey, // Changed from walletPubKey to multisigPda
    tokenMint: PublicKey,
    tokenType: TokenType,
    commitment: Commitment = 'confirmed',
  ): Promise<TokenBalance> {
    try {
      // Get the vault PDA directly from multisigPda
      const [vaultPda] = multisig.getVaultPda({ multisigPda, index: 0 });

      // Get the ATA for this token mint
      const ata = await getAssociatedTokenAddress(
        tokenMint,
        vaultPda,
        true,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );

      console.log(`Getting token balance for ${tokenType}:`, {
        multisigPda: multisigPda.toBase58(),
        vaultPda: vaultPda.toBase58(),
        ata: ata.toBase58(),
      });

      // Define TokenBalance with default values
      const tokenBalance: TokenBalance = {
        token: tokenType,
        balance: 0,
        ata: ata.toBase58(),
      };

      try {
        // Try to get the token account with retries
        let tokenAccount = null;
        let lastError = null;

        for (let attempt = 0; attempt < this.retryCount; attempt++) {
          try {
            console.log(
              `Getting token account ${tokenType} attempt ${attempt + 1}: ${ata.toBase58()}`,
            );
            tokenAccount = await solanaService.getSolanaAccount(ata.toBase58(), commitment);
            if (tokenAccount) break;
          } catch (error) {
            lastError = error;
            console.log(`Attempt ${attempt + 1} failed for ${tokenType}:`, error);
            // Only wait if we're going to retry
            if (attempt < this.retryCount - 1) {
              await new Promise((resolve) =>
                setTimeout(resolve, this.retryDelay * Math.pow(2, attempt)),
              );
            }
          }
        }

        if (!tokenAccount) {
          console.log(`Token account not found for ${tokenType} after ${this.retryCount} attempts`);
          return tokenBalance;
        }

        // Get the token decimals
        const tokenInfo = TOKENS[tokenType];
        // Calculate the balance
        const balance = Number(tokenAccount.amount) / Math.pow(10, tokenInfo.decimals);

        console.log(`Success! ${tokenType} balance:`, balance);

        return {
          token: tokenType,
          balance,
          ata: ata.toBase58(),
        };
      } catch (error) {
        console.warn(`Could not fetch balance for ${tokenType}:`, error);
        return tokenBalance;
      }
    } catch (error) {
      console.error(`Error in getTokenBalance for ${tokenType}:`, error);
      return {
        token: tokenType,
        balance: 0,
        ata: null,
      };
    }
  }

  // Updated to use multisigPda directly
  async getAllTokenBalances(multisigPda: PublicKey): Promise<TokenBalance[]> {
    if (!multisigPda) {
      return Object.keys(TOKENS).map((key) => ({
        token: key as TokenType,
        balance: 0,
        ata: null,
      }));
    }

    console.log('Getting all token balances for multisig:', multisigPda.toBase58());

    const tokenBalancePromises = Object.entries(TOKENS).map(([tokenSymbol, tokenInfo]) => {
      const tokenType = tokenSymbol as TokenType;
      return this.getTokenBalance(multisigPda, tokenInfo.mint, tokenType);
    });

    // Execute all requests with a small delay between them to avoid rate limiting
    const balances: TokenBalance[] = [];
    for (const tokenPromise of tokenBalancePromises) {
      const balance = await tokenPromise;
      balances.push(balance);
      // Small delay to prevent hitting rate limits
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return balances;
  }
}

// Export a singleton instance
export const tokenBalanceService = new TokenBalanceService();
