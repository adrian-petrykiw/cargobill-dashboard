import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';

export default function Custom404() {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>Page Not Found | CargoBill</title>
      </Head>

      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-lg text-center">
          <h1 className="text-6xl font-bold text-primary mb-2">404</h1>
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">Page Not Found</h2>
          <p className="text-gray-600 mb-8">
            The page you're looking for doesn't exist or has been moved.
          </p>

          <div className="flex flex-col space-y-4">
            <Button onClick={() => router.back()} variant="outline" className="w-full">
              Go Back
            </Button>

            <Link href={ROUTES.DASHBOARD} passHref>
              <Button className="w-full">Return to Dashboard</Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
