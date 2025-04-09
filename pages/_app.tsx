// pages/_app.tsx
import type { AppProps } from 'next/app';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from '@/components/ui/sonner';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import '@/styles/globals.css';
import LocalPrivyProvider from '@/components/common/LocalPrivyProvider';
import { NotificationsProvider } from '@/components/providers/NotificationProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 60000, // 1 minute
      retry: 1,
    },
  },
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <LocalPrivyProvider>
      <QueryClientProvider client={queryClient}>
        <NotificationsProvider>
          <ErrorBoundary>
            <Component {...pageProps} />
            <Toaster />
          </ErrorBoundary>
        </NotificationsProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </LocalPrivyProvider>
  );
}
