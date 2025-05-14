// hooks/useFootprintToken.ts
import { useState } from 'react';

export function useFootprintToken() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getFootprintToken = async (organizationId: string, organizationCountry: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/footprint/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId,
          organizationCountry,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create Footprint session');
      }

      const data = await response.json();
      setIsLoading(false);
      return data.token;
    } catch (err) {
      console.error('Error fetching Footprint token:', err);
      setError('Unable to initialize verification');
      setIsLoading(false);
      return null;
    }
  };

  return { getFootprintToken, isLoading, error };
}
