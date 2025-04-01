// pages/dashboard/index.tsx
import { GetServerSideProps } from 'next';
import { PrivyClient } from '@privy-io/server-auth';

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const cookieAuthToken = req.cookies['privy-token'];

  // If no cookie is found, redirect to login
  if (!cookieAuthToken) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  // Initialize PrivyClient only in this server context
  const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;
  const privyClient = new PrivyClient(PRIVY_APP_ID!, PRIVY_APP_SECRET!);

  try {
    const claims = await privyClient.verifyAuthToken(cookieAuthToken);

    // Get user data if needed
    const user = await privyClient.getUser(claims.userId);

    // Pass data to the page
    return {
      props: {
        user: {
          id: user.id,
          email: user.email?.address,
          // Include other user data as needed
        },
      },
    };
  } catch (error) {
    // Invalid token, redirect to login
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }
};
