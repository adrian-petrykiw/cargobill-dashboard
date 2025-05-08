// pages/signup/index.tsx
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import Image from 'next/image';
import { ROUTES } from '@/constants/routes';
import RootLayout from '@/components/layouts/RootLayout';
import useAuth from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function SignupPage() {
  const router = useRouter();
  const { login, verifyServerAuth, isCheckingAuth } = useAuth();
  const { ready, authenticated } = usePrivy();
  const signUp = login(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (isCheckingAuth) return;

      if (ready) {
        if (authenticated) {
          const { authenticated: serverAuthenticated } = await verifyServerAuth();
          if (serverAuthenticated) {
            router.push(ROUTES.DASHBOARD);
          }
        }
      }
    };

    checkAuth();
  }, [ready, authenticated, router, verifyServerAuth, isCheckingAuth]);

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
              onClick={signUp}
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
