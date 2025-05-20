// services/blockchain/tokenBalance.ts
import { Connection, PublicKey, Commitment } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import * as multisig from '@sqds/multisig';
import { TOKENS, STABLECOINS } from '@/constants/solana';
import { TokenBalance, TokenType } from '@/types/token';
import { solanaService } from './solana';

export class TokenBalanceService {
  private retryCount = 3;
  private retryDelay = 1000;

  // Renamed to be more specific about multisig usage
  async getMultisigSolBalance(
    multisigPda: PublicKey,
    commitment: Commitment = 'confirmed',
  ): Promise<TokenBalance> {
    try {
      // Get the vault PDA directly from multisigPda
      const [vaultPda] = multisig.getVaultPda({ multisigPda, index: 0 });

      console.log(`Getting SOL balance for multisig vault:`, {
        multisigPda: multisigPda.toBase58(),
        vaultPda: vaultPda.toBase58(),
      });

      let balance = 0;
      let lastError = null;

      // Try to get SOL balance with retries
      for (let attempt = 0; attempt < this.retryCount; attempt++) {
        try {
          console.log(`Getting SOL balance attempt ${attempt + 1}: ${vaultPda.toBase58()}`);

          // Use the SolanaService method to get SOL balance
          balance = await solanaService.getSolBalance(vaultPda, commitment);

          console.log(`Success! SOL balance: ${balance} SOL`);
          break;
        } catch (error) {
          lastError = error;
          console.log(`SOL balance attempt ${attempt + 1} failed:`, error);
          // Only wait if we're going to retry
          if (attempt < this.retryCount - 1) {
            await new Promise((resolve) =>
              setTimeout(resolve, this.retryDelay * Math.pow(2, attempt)),
            );
          }
        }
      }

      return {
        token: 'SOL',
        balance,
        ata: null, // SOL doesn't use ATAs
      };
    } catch (error) {
      console.error(`Error getting multisig SOL balance:`, error);
      return {
        token: 'SOL',
        balance: 0,
        ata: null,
      };
    }
  }

  // Method for getting SPL token balances (USDC, USDT, EURC)
  async getSplTokenBalance(
    multisigPda: PublicKey,
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

      console.log(`Getting ${tokenType} balance:`, {
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
              `Getting ${tokenType} token account attempt ${attempt + 1}: ${ata.toBase58()}`,
            );
            tokenAccount = await solanaService.getSolanaAccount(ata.toBase58(), commitment);
            if (tokenAccount) break;
          } catch (error) {
            lastError = error;
            console.log(`${tokenType} attempt ${attempt + 1} failed:`, error);
            // Only wait if we're going to retry
            if (attempt < this.retryCount - 1) {
              await new Promise((resolve) =>
                setTimeout(resolve, this.retryDelay * Math.pow(2, attempt)),
              );
            }
          }
        }

        if (!tokenAccount) {
          console.log(`${tokenType} token account not found after ${this.retryCount} attempts`);
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
      console.error(`Error in getSplTokenBalance for ${tokenType}:`, error);
      return {
        token: tokenType,
        balance: 0,
        ata: null,
      };
    }
  }

  // Main method that routes to the appropriate balance getter
  async getTokenBalance(
    multisigPda: PublicKey,
    tokenMint: PublicKey | null,
    tokenType: TokenType,
    commitment: Commitment = 'confirmed',
  ): Promise<TokenBalance> {
    // Handle SOL separately from SPL tokens
    if (tokenType === 'SOL' || tokenMint === null) {
      return this.getMultisigSolBalance(multisigPda, commitment);
    } else {
      return this.getSplTokenBalance(multisigPda, tokenMint, tokenType, commitment);
    }
  }

  // Updated to handle SOL differently from SPL tokens
  async getAllTokenBalances(multisigPda: PublicKey): Promise<TokenBalance[]> {
    if (!multisigPda) {
      return Object.keys(TOKENS).map((key) => ({
        token: key as TokenType,
        balance: 0,
        ata: null,
      }));
    }

    console.log('Getting all token balances for multisig:', multisigPda.toBase58());

    const balances: TokenBalance[] = [];

    // Get SOL balance first (native token)
    try {
      const solBalance = await this.getMultisigSolBalance(multisigPda);
      balances.push(solBalance);
      // Small delay to prevent hitting rate limits
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Error getting SOL balance:', error);
      balances.push({
        token: 'SOL',
        balance: 0,
        ata: null,
      });
    }

    // Get SPL token balances (stablecoins)
    const stablecoinPromises = Object.entries(STABLECOINS).map(([tokenSymbol, tokenInfo]) => {
      const tokenType = tokenSymbol as TokenType;
      return this.getSplTokenBalance(multisigPda, tokenInfo.mint, tokenType);
    });

    // Execute all SPL token requests with delays
    for (const tokenPromise of stablecoinPromises) {
      try {
        const balance = await tokenPromise;
        balances.push(balance);
      } catch (error) {
        console.error('Error getting stablecoin balance:', error);
      }
      // Small delay to prevent hitting rate limits
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return balances;
  }
}

// Export a singleton instance
export const tokenBalanceService = new TokenBalanceService();
