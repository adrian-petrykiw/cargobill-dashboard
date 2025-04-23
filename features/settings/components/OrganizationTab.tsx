// components/settings/OrganizationTab.tsx
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useOnboardingStore } from '@/stores/onboardingStore';

// Form schema for business verification
const businessSchema = z.object({
  legalName: z.string().min(1, 'Legal name is required'),
  ein: z.string().min(1, 'EIN/Tax ID is required'),
  businessType: z.string().min(1, 'Business type is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zipCode: z.string().min(1, 'ZIP code is required'),
  country: z.string().min(1, 'Country is required'),
  phone: z.string().min(1, 'Phone number is required'),
  website: z.string().optional(),
});

type BusinessFormData = z.infer<typeof businessSchema>;

export default function OrganizationTab() {
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const { businessVerified, setBusinessVerified } = useOnboardingStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BusinessFormData>({
    resolver: zodResolver(businessSchema),
    defaultValues: {
      legalName: '',
      ein: '',
      businessType: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      country: '',
      phone: '',
      website: '',
    },
  });

  const onSubmit = async (data: BusinessFormData) => {
    try {
      // In a real implementation, you would save this data to your backend
      console.log('Saving business verification data:', data);

      // For demonstration, set the business verified flag
      setBusinessVerified(true);

      setIsVerificationModalOpen(false);
    } catch (error) {
      console.error('Error saving business verification:', error);
    }
  };

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
                <p>Illini Logistics LLC</p>
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

      {/* Business Verification Modal */}
      <Dialog open={isVerificationModalOpen} onOpenChange={setIsVerificationModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Business Verification</DialogTitle>
            <DialogDescription>
              Please provide your business details for verification. This information helps us
              comply with regulations and protect your account.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="legalName">Legal Business Name</Label>
                <Input id="legalName" {...register('legalName')} />
                {errors.legalName && (
                  <p className="text-sm text-red-500">{errors.legalName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="ein">EIN/Tax ID</Label>
                <Input id="ein" {...register('ein')} />
                {errors.ein && <p className="text-sm text-red-500">{errors.ein.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessType">Business Type</Label>
                <Input id="businessType" {...register('businessType')} />
                {errors.businessType && (
                  <p className="text-sm text-red-500">{errors.businessType.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" {...register('address')} />
                {errors.address && <p className="text-sm text-red-500">{errors.address.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" {...register('city')} />
                {errors.city && <p className="text-sm text-red-500">{errors.city.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">State/Province</Label>
                <Input id="state" {...register('state')} />
                {errors.state && <p className="text-sm text-red-500">{errors.state.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="zipCode">ZIP/Postal Code</Label>
                <Input id="zipCode" {...register('zipCode')} />
                {errors.zipCode && <p className="text-sm text-red-500">{errors.zipCode.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input id="country" {...register('country')} />
                {errors.country && <p className="text-sm text-red-500">{errors.country.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Business Phone</Label>
                <Input id="phone" {...register('phone')} />
                {errors.phone && <p className="text-sm text-red-500">{errors.phone.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website (Optional)</Label>
                <Input id="website" {...register('website')} />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => setIsVerificationModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Verification'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
