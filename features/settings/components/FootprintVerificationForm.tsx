// components/settings/FootprintVerificationForm.tsx
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import footprint from '@onefootprint/footprint-js';
import Spinner from '@/components/common/Spinner';
import axios from 'axios';

interface FootprintVerificationFormProps {
  organizationId: string;
  organizationName: string;
  organizationEmail: string;
  organizationCountry: string;
  onComplete: (validationToken: string) => void;
}

export default function FootprintVerificationForm({
  organizationId,
  organizationName,
  organizationEmail,
  organizationCountry,
  onComplete,
}: FootprintVerificationFormProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [footprintToken, setFootprintToken] = useState<string | null>(null);
  const containerId = 'footprint-verification-container';

  useEffect(() => {
    const fetchFootprintToken = async () => {
      try {
        setIsLoading(true);

        // Use axios instead of fetch for consistency
        const { data } = await axios.post('/api/footprint/create-session', {
          organizationId,
          organizationCountry,
        });

        if (!data.success) {
          throw new Error(data.error || 'Failed to create Footprint session');
        }

        setFootprintToken(data.data.token);
      } catch (err) {
        console.error('Error fetching Footprint token:', err);

        // Improved error handling with more specific messages
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 404) {
            setError('Verification service endpoint not found. Please contact support.');
          } else if (err.response?.data?.error) {
            setError(`Verification error: ${err.response.data.error}`);
          } else {
            setError('Unable to initialize verification. Please try again later.');
          }
        } else {
          setError('Unable to initialize verification. Please try again later.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchFootprintToken();
  }, [organizationId, organizationCountry]);

  useEffect(() => {
    if (footprintToken) {
      const bootstrapData: Record<string, string> = {
        'business.name': organizationName,
      };

      // Only add email if it exists
      if (organizationEmail) {
        bootstrapData['id.email'] = organizationEmail;
      }

      const component = footprint.init({
        kind: 'verify',
        authToken: footprintToken,
        bootstrapData,
        onComplete: (validationToken) => {
          console.log('Footprint verification completed:', validationToken);
          onComplete(validationToken);
        },
        onError: (error) => {
          console.error('Footprint verification error:', error);
          setError(`Verification error: ${error}`);
        },
        onCancel: () => {
          console.log('Footprint verification cancelled');
        },
        appearance: {
          variables: {
            borderRadius: '0.5rem',
            buttonPrimaryBg: '#315E4C',
            buttonPrimaryHoverBg: '#46866c',
            buttonPrimaryColor: '#FFF',
            colorAccent: '#315E4C',
          },
        },
      });

      component.render();
    }
  }, [footprintToken, organizationName, organizationEmail, onComplete]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Spinner className="h-8 w-8 text-gray-400" />
          <p className="ml-3 text-gray-500">Initializing verification...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div id={containerId} className="flex-1 min-h-[80vh]"></div>
    </div>
  );
}
