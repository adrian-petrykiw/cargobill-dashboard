// hooks/useVendorDetails.tsx
import { useQuery } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import { getVaultPda } from '@sqds/multisig';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { TOKENS } from '@/constants/solana';
import { TokenType } from '@/types/token';
import { VendorDetails } from '@/schemas/organization.schema';

export interface ExtendedVendorDetails extends VendorDetails {
  vaultAddress: string;
  tokenAtas: Record<Exclude<TokenType, 'SOL'>, string>;
}

export function useVendorDetails(vendorId: string | null) {
  return useQuery<ExtendedVendorDetails | null, Error>({
    queryKey: ['vendor', vendorId],
    queryFn: async () => {
      if (!vendorId) {
        return null;
      }

      try {
        const response = await fetch(`/api/vendors/${vendorId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch vendor details');
        }

        const result = await response.json();
        if (!result.success || !result.data) {
          throw new Error(result.error?.message || 'Failed to fetch vendor details');
        }

        const vendorDetails = result.data as VendorDetails;

        if (!vendorDetails.multisigAddress) {
          throw new Error('Vendor has no valid multisig address');
        }

        // Derive vault address from multisig address using Squads protocol
        const multisigPda = new PublicKey(vendorDetails.multisigAddress);
        const [vaultPda] = getVaultPda({
          multisigPda,
          index: 0,
        });

        // Generate associated token addresses for each supported stablecoin
        const tokenAtas: Record<Exclude<TokenType, 'SOL'>, string> = {} as Record<
          Exclude<TokenType, 'SOL'>,
          string
        >;

        // Get ATAs for each stablecoin
        const stablecoins: Exclude<TokenType, 'SOL'>[] = ['USDC', 'USDT', 'EURC'];

        for (const token of stablecoins) {
          const ata = await getAssociatedTokenAddress(
            TOKENS[token].mint,
            vaultPda,
            true, // allowOwnerOffCurve = true for PDAs
          );
          tokenAtas[token] = ata.toBase58();
        }

        // Return extended vendor details with derived addresses
        return {
          ...vendorDetails,
          vaultAddress: vaultPda.toBase58(),
          tokenAtas,
        };
      } catch (error) {
        console.error(`Error fetching vendor details for ${vendorId}:`, error);
        throw error instanceof Error ? error : new Error(String(error));
      }
    },
    enabled: !!vendorId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
