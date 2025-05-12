// pages/dashboard/index.tsx
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
import type { Organization } from '@/schemas/organization.schema';

export default function Dashboard() {
  const user = useUserStore((state) => state.user);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const queryClient = useQueryClient();

  // Use the organizations hook
  const { organizations, isLoading: isLoadingOrgs } = useOrganizations();

  // Determine if we should show onboarding
  useEffect(() => {
    if (!isLoadingOrgs && user) {
      // If user has no organizations, show onboarding
      if (organizations.length === 0) {
        setShowOnboarding(true);
        return;
      }

      // Get primary organization (user should only ever be in one org)
      const primaryOrg = organizations[0];

      // Check for basic required fields
      const hasBasicInfo =
        !!primaryOrg.name && !!primaryOrg.country && !!primaryOrg.primary_address;

      // Check for operational wallet
      const hasOperationalWallet = !!primaryOrg.operational_wallet;

      // Show onboarding if basic info or operational wallet is missing
      if (!hasBasicInfo || !hasOperationalWallet) {
        setShowOnboarding(true);
      }
    }
  }, [user, organizations, isLoadingOrgs]);

  // Handle onboarding modal close
  const handleCloseOnboarding = () => {
    setShowOnboarding(false);
    // Force refresh organizations data to check if onboarding is still needed
    queryClient.invalidateQueries({ queryKey: ['userOrganizations'] });
  };

  return (
    <ProtectedLayout title="Dashboard · CargoBill">
      <div className="space-y-5">
        {/* Add Onboarding Checklist */}
        <OnboardingChecklist />

        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Overview</h1>
          <div className="flex space-x-3">
            <Button className="min-w-[12rem] bg-tertiary hover:bg-blue-600">Send</Button>
            <Button className="min-w-[12rem] bg-slate-900 text-white hover:bg-slate-800">
              Request
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Business Wallet Card */}
          <Card className="shadow-sm">
            <CardHeader className="pb-0">
              <div className="flex items-between justify-between">
                <h2 className="text-md font-medium">Business Wallet (...3sw6)</h2>
                <div className="flex space-x-2">
                  <Button variant="link" className="text-xs p-0 h-auto">
                    Deposit +
                  </Button>
                  <Button variant="link" className="text-xs p-0 h-auto">
                    Withdraw -
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-2">
                <div className="text-xs text-gray-500">Total Balance</div>
                <div className="text-lg font-semibold">$800,003.34 USD</div>
              </div>
              <div className="aspect-[16/6] w-full mb-0">
                {/* Placeholder for chart */}
                <div className="aspect-[12/3] bg-gray-100 border-gray-200 border-[1px] rounded-md mb-2"></div>

                <div className="flex justify-between space-x-2 p-1 bg-white border-gray-200 border-[1px] rounded-md">
                  <Badge className="w-[100%] text-[10px] bg-blue-500 text-white hover:bg-blue-600 py-1 rounded-sm hover:cursor-pointer">
                    $350,001.10 USDC
                  </Badge>
                  <Badge className="w-[100%] text-[10px] bg-green-500 text-white hover:bg-green-600 py-1 rounded-sm hover:cursor-pointer">
                    $250,001.12 USDT
                  </Badge>
                  <Badge className="w-[100%] text-[10px] bg-purple-500 text-white hover:bg-purple-600 py-1 rounded-sm hover:cursor-pointer">
                    $200,001.12 EURC
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Volume Card */}
          <Card className="shadow-sm">
            <CardHeader className="pb-0">
              <div className="flex items-between justify-between">
                <h2 className="text-md font-medium">Volume</h2>
                <div className="text-xs text-gray-500">Period: 6M</div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-2">
                <div className="text-xs text-gray-500">Total Volume</div>
                <div className="text-lg font-semibold">$35,005.32 USD</div>
              </div>
              <div className="aspect-[16/6] w-full bg-gray-100 rounded-md mb-0">
                {/* Placeholder for chart */}
                <div className="text-xs text-gray-500"># of Transactions: 1,024</div>
              </div>
            </CardContent>
          </Card>

          {/* Treasury Card */}
          <Card className="shadow-sm">
            <CardHeader className="pb-0">
              <div className="flex items-between justify-between">
                <h2 className="text-md font-medium">Treasury (...r32Y)</h2>
                <Button variant="link" className="text-xs p-0 h-auto">
                  Manage →
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-2">
                <div className="text-xs text-gray-500">Total Yield</div>
                <div className="text-lg font-semibold">
                  $105.32 USD <span className="text-green-500 text-xs">+ 4.34%</span>
                </div>
              </div>
              <div className="aspect-[16/6] w-full bg-gray-100 rounded-md mb-0">
                {/* Placeholder for chart */}
                <div className="text-xs text-green-500">+ 5.94% $13.34 USD</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-md font-medium">Recent Activity</h2>
            <Button variant="link" className="text-xs p-0 h-auto">
              View all
            </Button>
          </div>

          <Card className="p-0 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="text-xs uppercase text-gray-500 py-3 px-6">
                      Date
                    </TableHead>
                    <TableHead className="text-xs uppercase text-gray-500 py-3 px-6">
                      Category
                    </TableHead>
                    <TableHead className="text-xs uppercase text-gray-500 py-3 px-6">
                      To/From
                    </TableHead>
                    <TableHead className="text-xs uppercase text-gray-500 py-3 px-6">
                      Notes
                    </TableHead>
                    <TableHead className="text-xs uppercase text-gray-500 py-3 px-6">
                      Payment Method
                    </TableHead>
                    <TableHead className="text-xs uppercase text-gray-500 py-3 px-6">
                      Status
                    </TableHead>
                    <TableHead className="text-xs uppercase text-gray-500 py-3 px-6">
                      Amount
                    </TableHead>
                    <TableHead className="text-xs uppercase text-gray-500 py-3 px-6">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-200">
                  <TableRow>
                    <TableCell className="py-3 px-3 text-xs text-gray-500">-</TableCell>
                    <TableCell className="py-3 px-3 text-xs">Freight Forwarding</TableCell>
                    <TableCell className="py-3 px-3 text-xs">
                      Gandhi International Inc. - Chicago
                    </TableCell>
                    <TableCell className="py-3 px-3 text-xs text-gray-500">None</TableCell>
                    <TableCell className="py-3 px-3 text-xs">Business Wallet (...3sw6)</TableCell>
                    <TableCell className="py-3 px-3 text-xs">
                      <Badge
                        variant="outline"
                        className="bg-gray-200 text-gray-800 hover:bg-gray-200"
                      >
                        Draft
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 px-3 text-xs">USDC 2234.00</TableCell>
                    <TableCell className="py-3 px-3 text-xs">
                      <div className="flex space-x-2">
                        <Button
                          variant="link"
                          className="text-blue-600 hover:text-blue-800 p-0 h-auto"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="link"
                          className="text-red-600 hover:text-red-800 p-0 h-auto"
                        >
                          Cancel
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="py-3 px-3 text-xs text-gray-500">Due 1/1/25</TableCell>
                    <TableCell className="py-3 px-3 text-xs">Airline</TableCell>
                    <TableCell className="py-3 px-3 text-xs">
                      Malaysian Airways LLC. - Kuala
                    </TableCell>
                    <TableCell className="py-3 px-3 text-xs text-gray-500">None</TableCell>
                    <TableCell className="py-3 px-3 text-xs">Credit Card (Chase 9876)</TableCell>
                    <TableCell className="py-3 px-3 text-xs">
                      <Badge
                        variant="outline"
                        className="bg-blue-100 text-blue-800 hover:bg-blue-100"
                      >
                        Open
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 px-3 text-xs">USDC 100.00</TableCell>
                    <TableCell className="py-3 px-3 text-xs">
                      <div className="flex space-x-2">
                        <Button
                          variant="link"
                          className="text-blue-600 hover:text-blue-800 p-0 h-auto"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="link"
                          className="text-red-600 hover:text-red-800 p-0 h-auto"
                        >
                          Cancel
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>

      {/* Onboarding Modal */}
      <OrganizationSetupModal
        isOpen={showOnboarding}
        onClose={handleCloseOnboarding}
        userEmail={user?.email || ''}
      />
    </ProtectedLayout>
  );
}
