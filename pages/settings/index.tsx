// pages/settings/index.tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import ProtectedLayout from '@/components/layouts/ProtectedLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProfileTab from '@/features/settings/components/ProfileTab';
import OrganizationTab from '@/features/settings/components/OrganizationTab';
import LinkedAccountsTab from '@/features/settings/components/LinkedAccountsTab';

export default function Settings() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('profile');

  // Sync the URL query parameter with the active tab
  useEffect(() => {
    const tab = router.query.tab as string;
    if (tab) {
      setActiveTab(tab);
    }
  }, [router.query.tab]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    router.push(
      {
        pathname: router.pathname,
        query: { ...router.query, tab: value },
      },
      undefined,
      { shallow: true },
    );
  };

  return (
    <ProtectedLayout title="Settings · CargoBill">
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Settings</h1>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <div className="border-b border-gray-200">
            <div className="flex space-x-8">
              <button
                onClick={() => handleTabChange('profile')}
                className={`pb-4 px-1 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === 'profile'
                    ? ' border-blue-600 text-primary'
                    : 'border-background text-gray-400 hover:text-gray-600'
                }`}
              >
                My Profile
              </button>
              <button
                onClick={() => handleTabChange('organization')}
                className={`pb-4 px-1 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === 'organization'
                    ? ' border-blue-600 text-primary'
                    : 'border-background text-gray-400 hover:text-gray-600'
                }`}
              >
                Organization
              </button>
              <button
                onClick={() => handleTabChange('linked-accounts')}
                className={`pb-4 px-1 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === 'linked-accounts'
                    ? ' border-blue-600 text-primary'
                    : 'border-background text-gray-400 hover:text-gray-600'
                }`}
              >
                Linked Accounts
              </button>
            </div>
          </div>

          {activeTab === 'profile' && <ProfileTab />}
          {activeTab === 'organization' && <OrganizationTab />}
          {activeTab === 'linked-accounts' && <LinkedAccountsTab />}
        </Tabs>
      </div>
    </ProtectedLayout>
  );
}
