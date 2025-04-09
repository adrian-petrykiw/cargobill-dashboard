// pages/index.tsx

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { usePrivy } from '@privy-io/react-auth';
import { PrivyClient } from '@privy-io/server-auth';
import { GetServerSideProps } from 'next';
import { ROUTES } from '@/constants/routes';
import RootLayout from '@/components/layouts/RootLayout';
import Spinner from '@/components/common/Spinner';

// Server-side authentication check
// export const getServerSideProps: GetServerSideProps = async ({ req }) => {
//   const cookieAuthToken = req.cookies['privy-token'];

//   // If no cookie found, let the client-side handle it
//   if (!cookieAuthToken) return { props: {} };

//   const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
//   const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;
//   const client = new PrivyClient(PRIVY_APP_ID!, PRIVY_APP_SECRET!);

//   try {
//     // Verify the token
//     const claims = await client.verifyAuthToken(cookieAuthToken);
//     console.log('User authenticated server-side:', claims.userId);

//     // User is authenticated, redirect to dashboard
//     return {
//       redirect: {
//         destination: ROUTES.DASHBOARD,
//         permanent: false,
//       },
//     };
//   } catch (error) {
//     // Invalid token or verification failed, let client-side handle it
//     console.error('Token verification failed:', error);
//     return { props: {} };
//   }
// };

export default function Home() {
  console.log('Home component rendered');

  const router = useRouter();
  const { authenticated, ready } = usePrivy();

  // Client-side authentication check
  useEffect(() => {
    if (ready) {
      if (authenticated) {
        router.replace(ROUTES.DASHBOARD);
      } else {
        router.replace(ROUTES.AUTH.SIGNIN);
      }
    }
  }, [authenticated, ready, router]);

  // Loading state while checking authentication
  return (
    <RootLayout>
      <div className="flex items-center justify-center min-h-screen">
        <Spinner />
      </div>
    </RootLayout>
  );
}
