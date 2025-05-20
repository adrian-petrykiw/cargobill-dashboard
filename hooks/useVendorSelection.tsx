// hooks/useVendorSelection.tsx
import { VendorListItem } from '@/schemas/organization.schema';
import { useQuery } from '@tanstack/react-query';

export function useVendorSelection() {
  return useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/vendors');
        if (!response.ok) {
          throw new Error('Failed to fetch vendors');
        }

        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error?.error || 'Failed to fetch vendors');
        }

        return data.data as VendorListItem[];
      } catch (error) {
        console.error('Error fetching vendors:', error);
        throw error instanceof Error ? error : new Error(String(error));
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
