// components/settings/OrganizationTab.tsx
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useOrganizations } from '@/hooks/useOrganizations'; // Using the existing hook
import VerificationForm from './VerificationForm';

export default function OrganizationTab() {
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState<boolean>(false);
  const { businessVerified, setBusinessVerified } = useOnboardingStore();
  const { organization } = useOrganizations(); // Using the updated hook with organization property

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-md font-medium">Business Information</CardTitle>
        </CardHeader>
        <CardContent>
          {businessVerified ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Legal Name</h3>
                <p>{organization?.name || 'N/A'}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">EIN/Tax ID</h3>
                <p>••••••1234</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Business Type</h3>
                <p>Limited Liability Company</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Address</h3>
                <p>123 W Main St.</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">City</h3>
                <p>Chicago</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">State/Province</h3>
                <p>IL</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">ZIP/Postal Code</h3>
                <p>60623</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Country</h3>
                <p>United States</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Phone Number</h3>
                <p>+1 312 675 8769</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Website</h3>
                <p>www.illinilogistics.com</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <h3 className="font-medium text-gray-700 mb-2">Business Verification Required</h3>
              <p className="text-sm text-gray-500 mb-4">
                Verify your business to unlock full functionality and ensure compliance with
                regulations.
              </p>
              <Button onClick={() => setIsVerificationModalOpen(true)}>Verify Your Business</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Upload Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-md font-medium">Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {businessVerified ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <div>
                  <h3 className="font-medium">Certificate of Incorporation</h3>
                  <p className="text-sm text-gray-500">illini_logistics_articles_of_incorp.pdf</p>
                </div>
                <Button variant="outline" size="sm">
                  View
                </Button>
              </div>

              <div className="flex items-center justify-between border-b pb-2">
                <div>
                  <h3 className="font-medium">Proof of Beneficial Owners</h3>
                  <p className="text-sm text-gray-500">illini_logistics_tax_certificate.pdf</p>
                </div>
                <Button variant="outline" size="sm">
                  View
                </Button>
              </div>

              <Button variant="outline" className="w-full">
                Upload New Document
              </Button>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">
                You'll be able to manage your business documents after verification.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Business Verification Dialog with VerificationForm component */}
      {organization && (
        <Dialog open={isVerificationModalOpen} onOpenChange={setIsVerificationModalOpen}>
          <DialogContent className="max-w-4xl h-[80vh] overflow-y-auto">
            <VerificationForm organizationId={organization.id} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
