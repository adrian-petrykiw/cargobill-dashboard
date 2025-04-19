// @/pages/signup/index.tsx

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useLogin, usePrivy } from '@privy-io/react-auth';
import { PrivyClient } from '@privy-io/server-auth';
import { GetServerSideProps } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ROUTES } from '@/constants/routes';
import RootLayout from '@/components/layouts/RootLayout';

// Import shadcn components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

// Server-side authentication check
export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const cookieAuthToken = req.cookies['privy-token'];

  // If no cookie found, allow access to signup page
  if (!cookieAuthToken) return { props: {} };

  const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;
  const client = new PrivyClient(PRIVY_APP_ID!, PRIVY_APP_SECRET!);

  try {
    // Verify the token
    const claims = await client.verifyAuthToken(cookieAuthToken);

    // Token is valid, user is already authenticated, redirect to dashboard
    return {
      redirect: {
        destination: ROUTES.DASHBOARD,
        permanent: false,
      },
    };
  } catch (error) {
    // Invalid token, allow access to signup page
    return { props: {} };
  }
};

export default function SignupPage() {
  const router = useRouter();
  const { login } = useLogin({
    onComplete: () => router.push(ROUTES.DASHBOARD),
  });
  const { ready, authenticated } = usePrivy();

  // Client-side authentication check
  useEffect(() => {
    if (ready && authenticated) {
      router.push(ROUTES.DASHBOARD);
    }
  }, [ready, authenticated, router]);

  return (
    <RootLayout title="Sign up · CargoBill" description="Create your CargoBill account">
      <div className="flex h-screen w-full items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardHeader className="flex flex-col items-center space-y-1 pt-10">
            <Image
              src="/assets/cargobill_icon_logo.svg"
              alt="CargoBill Logo"
              width={60}
              height={60}
              className="h-8 w-8"
            />
            <CardTitle className="text-center text-xl font-medium">Welcome</CardTitle>
            <CardDescription className="text-center">Create your account</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 p-6">
            <Button
              onClick={login}
              className="h-10 w-full bg-slate-900 text-white hover:bg-slate-800"
              size="lg"
            >
              Sign up
            </Button>
            <div className="flex items-center justify-center gap-1 text-sm">
              <span className="text-muted-foreground">Already have an account?</span>
              <Link
                href={ROUTES.AUTH.SIGNIN || '#'}
                className="font-medium text-blue-600 hover:underline"
              >
                Sign in &rarr;
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </RootLayout>
  );
}
