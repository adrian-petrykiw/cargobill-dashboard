import Head from 'next/head';

type RootLayoutProps = {
  children: React.ReactNode;
  title?: string;
  description?: string;
};

export default function RootLayout({
  children,
  title = 'CargoBill',
  description = 'Web2-friendly stablecoin payments platform for supply chain',
}: RootLayoutProps) {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-gray-50 flex flex-col">
        <main className="flex-grow">{children}</main>
      </div>
    </>
  );
}
