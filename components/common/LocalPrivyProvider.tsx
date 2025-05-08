// components/common/LocalPrivyProvider.tsx
'use client';

import { PrivyProvider as Privy } from '@privy-io/react-auth';
import { useEffect, useState, memo } from 'react';

function LocalPrivyProvider({ children }: { children: React.ReactNode }) {
  const [isConfigured, setIsConfigured] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Ensure the APP_ID exists
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const clientId = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID;

    if (!appId || !clientId) {
      console.error('Error configuring Privy: Missing env');
      setErrorMessage('Privy configuration error: Missing App ID');
      return;
    }

    setIsConfigured(true);
  }, []);

  // Show error message if configuration failed
  if (errorMessage) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-red-50">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Configuration Error</h2>
          <p className="text-gray-600 mb-6">{errorMessage}</p>
          <p className="text-gray-600 mb-6">
            Please check your environment variables and ensure they are correctly set.
          </p>
        </div>
      </div>
    );
  }

  // Show loading state until configured
  if (!isConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <Privy
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ''}
      clientId={process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID || ''}
      config={{
        // Login methods configuration
        loginMethods: ['email', 'google'],
        // UI customization
        appearance: {
          // theme: 'light',
          // accentColor: '#3531FF', // CargoBill blue
          landingHeader: 'Login',
          // logo: '/assets/cargobill_icon_logo.svg',
        },

        // Embedded wallet configuration
        // embeddedWallets: {
        //   createOnLogin: 'off',
        //   showWalletUIs: true,
        // },

        embeddedWallets: {
          showWalletUIs: true,
          solana: {
            createOnLogin: 'users-without-wallets',
          },
        },

        mfa: {
          noPromptOnMfaRequired: false,
        },

        // Configure Solana clusters properly
        solanaClusters: [
          {
            name: 'mainnet-beta',
            rpcUrl: 'https://api.mainnet-beta.solana.com',
          },
        ],
      }}
    >
      {children}
    </Privy>
  );
}

export default memo(LocalPrivyProvider);
