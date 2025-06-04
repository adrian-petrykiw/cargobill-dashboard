// pages/dashboard/index.tsx (modified version with SendTransactionModal integration)
import { useState, useEffect } from 'react';
import ProtectedLayout from '@/components/layouts/ProtectedLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import OnboardingChecklist from '@/components/onboarding/OnboardingChecklist';
import { useUserStore } from '@/stores/userStore';
import { useQueryClient } from '@tanstack/react-query';
import { useOrganizations } from '@/hooks/useOrganizations';
import { OrganizationSetupModal } from '@/components/onboarding/OnboardingSetupModal';
import { toast } from 'react-hot-toast';
import { useSyncOnboardingState } from '@/hooks/useSyncOnboardingState';
import { BusinessWalletCard } from '@/features/dashboard/components/BusinessWalletCard';
import { SendTransactionModal } from '@/features/transactions/components/SendTransactionModal';
import { useSolanaWallets } from '@privy-io/react-auth';

export default function Dashboard() {
  const user = useUserStore((state) => state.user);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const queryClient = useQueryClient();
  const { organizations, isLoading: isLoadingOrgs, organization } = useOrganizations();
  useSyncOnboardingState();

  const { wallets, ready } = useSolanaWallets();
  const embeddedWallet = wallets.find((wallet) => wallet.walletClientType === 'privy');

  // Determine if we should show onboarding
  useEffect(() => {
    if (!isLoadingOrgs && user) {
      console.log('Dashboard - Organizations data:', organizations);

      // If user has no organizations, show onboarding
      if (!organizations || organizations.length === 0) {
        console.log('Dashboard - No organizations found, showing onboarding');
        setShowOnboarding(true);
        return;
      }

      // Get primary organization (user should only ever be in one org)
      const primaryOrg = organizations[0];
      console.log('Dashboard - Primary organization:', primaryOrg);

      // Check for basic required fields - let's be specific in our checks
      const hasName = Boolean(primaryOrg.name);
      const hasCountry = Boolean(primaryOrg.country);
      const hasBusinessDetails = Boolean(primaryOrg.business_details);
      const hasOperationalWallet = Boolean(primaryOrg.operational_wallet);

      // Check verification status based on the last_verified_at field
      const isVerified =
        primaryOrg.last_verified_at !== null && primaryOrg.verification_status === 'verified';

      console.log('Dashboard - Organization verification status:', {
        verificationStatus: primaryOrg.verification_status,
        lastVerifiedAt: primaryOrg.last_verified_at,
        isVerified,
      });

      const hasBasicInfo = hasName && hasCountry && hasBusinessDetails;

      console.log('Dashboard - Organization field checks:', {
        hasName,
        hasCountry,
        hasBusinessDetails,
        hasOperationalWallet,
        hasBasicInfo,
        isVerified,
      });

      // Show onboarding only if basic info or operational wallet is missing
      if (!hasBasicInfo || !hasOperationalWallet) {
        console.log('Dashboard - Missing required org fields, showing onboarding');
        setShowOnboarding(true);
      } else {
        console.log('Dashboard - Organization data complete, hiding onboarding');
        setShowOnboarding(false);
      }
    }
  }, [user, organizations, isLoadingOrgs]);

  // Handle onboarding modal close
  const handleCloseOnboarding = () => {
    setShowOnboarding(false);
    // Force refresh organizations data to check if onboarding is still needed
    queryClient.invalidateQueries({ queryKey: ['userOrganizations'] });

    // Add a timeout to ensure the modal is fully closed before potentially showing it again
    setTimeout(() => {
      // We need to fetch fresh data after the invalidation
      queryClient.refetchQueries({ queryKey: ['userOrganizations'] });
    }, 500);
  };

  // Check if business is verified
  const isBusinessVerified = !!(
    organization &&
    organization.last_verified_at !== null &&
    organization.verification_status === 'verified'
  );

  // Handle send button click
  const handleSendClick = () => {
    if (!isBusinessVerified) {
      toast.error(`Please complete business verification`, {
        duration: 3000,
        position: 'top-center',
        icon: '🔒',
      });
      return;
    }

    setShowSendModal(true);
  };

  const isWalletReady = ready && !!embeddedWallet?.address;

  return (
    <ProtectedLayout title="Dashboard · CargoBill">
      <div className="space-y-5">
        {/* Add Onboarding Checklist */}
        <OnboardingChecklist />

        <div className="flex items-end justify-between ">
          <h1 className="text-xl font-semibold mb-[-8px] ">Overview</h1>
          <div className="flex space-x-3 pb-0 ">
            <Button
              className="min-w-[12rem] bg-tertiary hover:bg-blue-600"
              onClick={handleSendClick}
            >
              Send
            </Button>
            <Button
              className="min-w-[12rem] bg-slate-900 text-white hover:bg-slate-800"
              onClick={(e) => {
                if (!isBusinessVerified) {
                  e.preventDefault();
                  e.stopPropagation();
                  toast.error('Please complete business verification', {
                    duration: 3000,
                    position: 'top-center',
                    icon: '🔒',
                  });
                  return;
                } else if (!isWalletReady) {
                  e.preventDefault();
                  e.stopPropagation();
                  toast.error('Wallet not connected', {
                    duration: 3000,
                    position: 'top-center',
                  });
                  return;
                } else {
                  // handleOpenModal();
                  toast.error('Contact support to unlock requests', {
                    duration: 3000,
                    position: 'top-center',
                  });
                }
              }}
            >
              Request
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Business Wallet Card */}
          <BusinessWalletCard />

          {/* Volume Card */}
          <Card className="shadow-sm">
            <CardHeader className="pb-0">
              <div className="flex items-between justify-between">
                <h2 className="text-md font-medium">Cashflow</h2>
                <div className="text-xs text-gray-500">Period: Last Month</div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-2 flex flex-row justify-between">
                <div>
                  <div className="text-xs text-gray-500">Money In</div>
                  <div className="text-lg font-semibold">$0.00 USD</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Money Out</div>
                  <div className="text-lg font-semibold">$0.00 USD</div>
                </div>
              </div>

              <div className="aspect-[16/6] w-full bg-gray-100 rounded-md mb-0">
                {/* Placeholder for chart */}
              </div>
            </CardContent>
          </Card>

          {/* Treasury Card */}
          <Card className="shadow-sm">
            <CardHeader className="pb-0">
              <div className="flex items-between justify-between">
                <h2 className="text-md font-medium">Treasury</h2>

                <Button
                  variant="ghost"
                  size="sm"
                  className="p-0 font-medium text-black hover:bg-transparent hover:text-gray-600 mr-[4px]"
                  onClick={(e) => {
                    if (!isBusinessVerified) {
                      e.preventDefault();
                      e.stopPropagation();
                      toast.error('Please complete business verification', {
                        duration: 3000,
                        position: 'top-center',
                        icon: '🔒',
                      });
                      return;
                    } else if (!isWalletReady) {
                      e.preventDefault();
                      e.stopPropagation();
                      toast.error('Wallet not connected', {
                        duration: 3000,
                        position: 'top-center',
                      });
                      return;
                    } else {
                      // handleOpenModal();
                      toast.error('Upgrade business tier to unlock yield', {
                        duration: 3000,
                        position: 'top-center',
                      });
                    }
                  }}
                >
                  Manage →
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-2">
                <div className="text-xs text-gray-500">Total Yield</div>
                <div className="text-lg font-semibold">
                  $0.00 USD
                  <span className="text-green-500 text-xs ml-2">+0.00%</span>
                </div>
              </div>
              <div className="aspect-[16/6] w-full bg-gray-100 rounded-md mb-0">
                {/* Placeholder for chart */}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-md font-medium">Recent Activity</h2>
          </div>

          <Card>
            <CardContent>
              <div className="text-center py-16">
                <p className="text-gray-400 text-xs">No recent activity</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Onboarding Modal */}
      <OrganizationSetupModal
        isOpen={showOnboarding}
        onClose={handleCloseOnboarding}
        userEmail={user?.email || ''}
      />

      {/* Send Transaction Modal */}
      <SendTransactionModal isOpen={showSendModal} onClose={() => setShowSendModal(false)} />
    </ProtectedLayout>
  );
}
