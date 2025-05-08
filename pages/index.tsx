// pages/index.tsx
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { usePrivy } from '@privy-io/react-auth';
import { ROUTES } from '@/constants/routes';
import RootLayout from '@/components/layouts/RootLayout';
import Spinner from '@/components/common/Spinner';
import useAuth from '@/hooks/useAuth';

export default function Home() {
  console.log('Home component rendered');

  const router = useRouter();
  const { authenticated, ready } = usePrivy();
  const { isCheckingAuth } = useAuth();

  // Client-side authentication check
  useEffect(() => {
    if (ready && !isCheckingAuth) {
      if (authenticated) {
        router.replace(ROUTES.DASHBOARD);
      } else {
        router.replace(ROUTES.AUTH.BASE); // Default to signin mode
      }
    }
  }, [authenticated, ready, router, isCheckingAuth]);

  // Loading state while checking authentication
  return (
    <RootLayout>
      <div className="flex items-center justify-center min-h-screen">
        <Spinner />
      </div>
    </RootLayout>
  );
}
