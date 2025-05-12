// pages/auth.tsx
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import Image from 'next/image';
import { ROUTES } from '@/constants/routes';
import RootLayout from '@/components/layouts/RootLayout';
import useAuth from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AuthPage() {
  const router = useRouter();
  const { login, verifyServerAuth, isCheckingAuth } = useAuth();
  const { ready, authenticated } = usePrivy();
  const authenticate = login(false); // Default to signin flow

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
    <RootLayout title="CargoBill Authentication" description="Access your CargoBill account">
      <div className="flex h-screen w-full items-center justify-center">
        <Card className="w-full max-w-sm gap-6 pt-8 pb-6">
          <CardHeader className="flex flex-col items-center space-y-1">
            <Image
              src="/assets/cargobill_icon_logo.svg"
              alt="CargoBill Logo"
              width={60}
              height={60}
              className="h-8 w-8"
            />
            <CardTitle className="text-center text-xl font-medium">Welcome</CardTitle>
            <CardDescription className="text-center">
              Login to your CargoBill account
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 px-6">
            <Button
              onClick={authenticate}
              className="h-10 w-full bg-slate-900 text-white hover:bg-slate-800"
              size="lg"
              disabled={isCheckingAuth}
            >
              {isCheckingAuth ? 'Authenticating...' : 'Login'}
            </Button>
            <div className="flex items-center justify-end gap-1 text-sm">
              <span className="text-muted-foreground">Don't have access?</span>
              <Link
                href="https://cargobill.co/#contact"
                className="font-medium text-navy hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Request →
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </RootLayout>
  );
}
