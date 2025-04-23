// pages/_app.tsx
import type { AppProps } from 'next/app';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from '@/components/ui/sonner';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import '@/styles/globals.css';
import LocalPrivyProvider from '@/components/common/LocalPrivyProvider';
import { NotificationsProvider } from '@/components/providers/NotificationProvider';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 60000, // 1 minute
      retry: 1,
      gcTime: 300000,
    },
  },
});

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [isRouteChanging, setIsRouteChanging] = useState(false);

  useEffect(() => {
    const handleStart = () => setIsRouteChanging(true);
    const handleComplete = () => setIsRouteChanging(false);

    router.events.on('routeChangeStart', handleStart);
    router.events.on('routeChangeComplete', handleComplete);
    router.events.on('routeChangeError', handleComplete);

    return () => {
      router.events.off('routeChangeStart', handleStart);
      router.events.off('routeChangeComplete', handleComplete);
      router.events.off('routeChangeError', handleComplete);
    };
  }, [router]);

  return (
    <LocalPrivyProvider>
      <QueryClientProvider client={queryClient}>
        <NotificationsProvider>
          <ErrorBoundary>
            {isRouteChanging && (
              <div className="fixed top-0 left-0 w-full h-1 bg-blue-600 z-50 animate-pulse" />
            )}
            <Component {...pageProps} />
            <Toaster />
          </ErrorBoundary>
        </NotificationsProvider>
        {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </LocalPrivyProvider>
  );
}
