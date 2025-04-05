import Head from 'next/head';
import ProtectedLayout from '@/components/layouts/ProtectedLayout';

export default function Dashboard() {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-4">DASHBOARD</h1>
      <p className="text-gray-600">
        Your all-in-one platform for supply chain payments and management
      </p>
    </div>
  );
  // return (
  //   <ProtectedLayout>
  //     <Head>
  //       <title>Dashboard | CargoBill</title>
  //     </Head>

  //     <div className="bg-white p-6 rounded-lg shadow">
  //       <h1 className="text-2xl font-bold mb-4">Welcome to CargoBill</h1>
  //       <p className="text-gray-600">
  //         Your all-in-one platform for supply chain payments and management
  //       </p>
  //     </div>
  //   </ProtectedLayout>
  // );
}
