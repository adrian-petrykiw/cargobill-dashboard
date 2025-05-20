// services/blockchain/multisig.ts
import { PublicKey, Commitment } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import * as multisig from '@sqds/multisig';
import { STABLECOINS } from '@/constants/solana';
import { TokenType } from '@/types/token';
import { solanaService } from './solana';

// Define stablecoin type for this service
type StablecoinType = Exclude<TokenType, 'SOL'>;

export interface VaultInitResult {
  success: boolean;
  ata?: PublicKey;
  vaultPda?: PublicKey;
  multisigPda?: PublicKey;
  error?: string;
}

export class MultisigService {
  private static instance: MultisigService;

  private constructor() {}

  public static getInstance(): MultisigService {
    if (!MultisigService.instance) {
      MultisigService.instance = new MultisigService();
    }
    return MultisigService.instance;
  }

  /**
   * Get multisig and vault PDAs for a given create key
   */
  getMultisigAddresses(createKey: PublicKey): {
    multisigPda: PublicKey;
    vaultPda: PublicKey;
  } {
    const [multisigPda] = multisig.getMultisigPda({ createKey });
    const [vaultPda] = multisig.getVaultPda({ multisigPda, index: 0 });

    return { multisigPda, vaultPda };
  }

  /**
   * Get the ATA address for a token in the multisig vault
   */
  async getVaultTokenAddress(createKey: PublicKey, tokenType: StablecoinType): Promise<PublicKey> {
    const { vaultPda } = this.getMultisigAddresses(createKey);
    const tokenInfo = STABLECOINS[tokenType];

    if (!tokenInfo?.mint) {
      throw new Error(`Invalid stablecoin configuration for ${tokenType}`);
    }

    return await getAssociatedTokenAddress(
      tokenInfo.mint,
      vaultPda,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
  }

  /**
   * Check if a token account exists for the given ATA
   */
  async checkTokenAccountExists(
    ata: PublicKey,
    commitment: Commitment = 'confirmed',
  ): Promise<boolean> {
    try {
      const tokenAccount = await solanaService.getSolanaAccount(ata, commitment);
      return tokenAccount !== null;
    } catch (error) {
      console.log(`ATA check error (expected if not yet created):`, error);
      return false;
    }
  }

  /**
   * Initialize vault and create ATA for a stablecoin
   * This calls the backend API to create the necessary transactions
   */
  async initializeVaultTokenAccount(
    userWallet: PublicKey,
    tokenType: StablecoinType,
    retryAttempts: number = 3,
  ): Promise<VaultInitResult> {
    try {
      console.log(`Starting vault and ATA initialization for ${tokenType}...`);

      // Get addresses
      const { multisigPda, vaultPda } = this.getMultisigAddresses(userWallet);
      const ata = await this.getVaultTokenAddress(userWallet, tokenType);
      const tokenInfo = STABLECOINS[tokenType];

      console.log('Multisig vault addresses:', {
        userWallet: userWallet.toBase58(),
        multisigPda: multisigPda.toBase58(),
        vaultPda: vaultPda.toBase58(),
        ata: ata.toBase58(),
        token: tokenType,
      });

      // Check if ATA already exists
      const ataExists = await this.checkTokenAccountExists(ata);

      if (ataExists) {
        console.log(`ATA already exists for ${tokenType}`);
        return {
          success: true,
          ata,
          vaultPda,
          multisigPda,
        };
      }

      // Initialize vault with retries
      console.log(`Initializing vault and creating ATA for ${tokenType}...`);
      let initAttempts = 0;

      while (initAttempts < retryAttempts) {
        try {
          console.log(`Initialization attempt ${initAttempts + 1}`);

          // Call backend API to initialize vault
          const response = await fetch('/api/organizations/init-fund-token-vault', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userWallet: userWallet.toBase58(),
              multisigPda: multisigPda.toBase58(),
              tokenMint: tokenInfo.mint!.toBase58(),
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to initialize vault');
          }

          const data = await response.json();
          console.log('Init response:', data);

          if (!data.signature) {
            throw new Error('No signature returned from initialization');
          }

          // Wait for initial confirmation
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Confirm transaction
          await solanaService.confirmTransactionWithRetry(data.signature, 'confirmed', 3, 30000);

          // Additional verification wait
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Verify ATA creation
          const verifySuccess = await this.checkTokenAccountExists(ata);
          if (verifySuccess) {
            console.log(`Setup verified successfully for ${tokenType}`);
            return {
              success: true,
              ata,
              vaultPda,
              multisigPda,
            };
          }

          throw new Error('Setup verification failed');
        } catch (initError: unknown) {
          console.error(`Initialization attempt ${initAttempts + 1} failed:`, initError);
          initAttempts++;

          if (initAttempts === retryAttempts) {
            const errorMessage =
              initError instanceof Error ? initError.message : 'Failed to initialize';
            return {
              success: false,
              error: errorMessage,
            };
          }

          // Wait before retry with exponential backoff
          await new Promise((resolve) => setTimeout(resolve, 2000 * Math.pow(2, initAttempts - 1)));
        }
      }

      return {
        success: false,
        error: 'Failed to initialize after all retry attempts',
      };
    } catch (error: unknown) {
      console.error(`Vault/ATA initialization error for ${tokenType}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize vault';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Check vault and ATA status, initializing if needed
   * This is the main function that components should use
   */
  async ensureVaultTokenAccount(
    userWallet: PublicKey,
    tokenType: StablecoinType,
  ): Promise<VaultInitResult> {
    try {
      // First check if everything is already set up
      const { multisigPda, vaultPda } = this.getMultisigAddresses(userWallet);
      const ata = await this.getVaultTokenAddress(userWallet, tokenType);

      const ataExists = await this.checkTokenAccountExists(ata);

      if (ataExists) {
        return {
          success: true,
          ata,
          vaultPda,
          multisigPda,
        };
      }

      // Initialize if needed
      return await this.initializeVaultTokenAccount(userWallet, tokenType);
    } catch (error: unknown) {
      console.error(`Error ensuring vault token account for ${tokenType}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to ensure vault setup';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}

// Export singleton instance
export const multisigService = MultisigService.getInstance();
