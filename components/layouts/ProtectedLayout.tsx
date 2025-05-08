// components/layouts/ProtectedLayout.tsx
import { useEffect, memo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { usePrivy } from '@privy-io/react-auth';
import { ROUTES } from '@/constants/routes';
import AppSidebar from '../common/AppSidebar';
import AppHeader from '../common/AppHeader';
import Spinner from '../common/Spinner';
import useAuth from '@/hooks/useAuth';

type ProtectedLayoutProps = {
  children: React.ReactNode;
  title?: string;
};

function ProtectedLayout({ children, title = 'CargoBill' }: ProtectedLayoutProps) {
  const router = useRouter();
  const { ready, authenticated } = usePrivy();
  const { isCheckingAuth } = useAuth();

  // Only redirect if not authenticated and not in the process of checking auth
  useEffect(() => {
    if (ready && !authenticated && !isCheckingAuth) {
      router.replace(ROUTES.AUTH.SIGNIN);
    }
  }, [ready, authenticated, router, isCheckingAuth]);

  // Show loading state during authentication check or when auth is being checked
  if (!ready || !authenticated || isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>

      <div className="flex h-screen flex-col">
        <AppHeader />
        <div className="flex flex-1 overflow-hidden">
          <AppSidebar />
          <main className="flex-1 overflow-y-auto bg-gray-50 p-6">{children}</main>
        </div>
      </div>
    </>
  );
}

export default memo(ProtectedLayout);
