import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { usePrivy } from '@privy-io/react-auth';
import { ROUTES } from '@/constants/routes';

export default function Home() {
  const router = useRouter();
  const { authenticated, ready } = usePrivy();

  useEffect(() => {
    if (ready) {
      if (authenticated) {
        router.replace(ROUTES.DASHBOARD);
      } else {
        router.replace(ROUTES.AUTH.LOGIN);
      }
    }
  }, [authenticated, ready, router]);

  // Show loading spinner while checking auth state
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
  );
}
