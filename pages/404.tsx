// pages/404.tsx

import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ROUTES } from '@/constants/routes';

export default function Custom404() {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>Page Not Found | CargoBill</title>
      </Head>

      <div className="flex h-screen w-full items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="flex flex-col items-center space-y-2 pt-8">
            <CardTitle className="text-6xl font-bold text-primary">404</CardTitle>
            <CardDescription className="text-xl font-semibold text-gray-800">
              Page Not Found
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 p-6">
            <p className="text-center text-gray-600 mb-4 text-sm">
              The page you're looking for doesn't exist or has been moved.
            </p>
            <Button onClick={() => router.back()} variant="outline" className="w-full h-10">
              Go Back
            </Button>
            <Link href={ROUTES.DASHBOARD} passHref>
              <Button className="w-full h-10">Return to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
