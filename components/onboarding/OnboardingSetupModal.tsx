// components/onboarding/OrganizationSetupModal.tsx
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  onboardingOrganizationSchema,
  OnboardingOrganizationRequest,
} from '@/schemas/organization.schema';
import { useOnboarding } from '@/hooks/useOnboarding';

interface OrganizationSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
}

export function OrganizationSetupModal({
  isOpen,
  onClose,
  userEmail,
}: OrganizationSetupModalProps) {
  const [primaryEmailSameAsAdmin, setPrimaryEmailSameAsAdmin] = useState(true);
  const { createOrganization, isCreating } = useOnboarding();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OnboardingOrganizationRequest>({
    resolver: zodResolver(onboardingOrganizationSchema),
    defaultValues: {
      business_email: userEmail,
    },
  });

  const watchedEmail = watch('business_email');

  // Update business email when checkbox changes
  const handlePrimaryEmailToggle = (checked: boolean) => {
    setPrimaryEmailSameAsAdmin(checked);
    if (checked) {
      setValue('business_email', userEmail);
    }
  };

  const onSubmit = async (data: OnboardingOrganizationRequest) => {
    try {
      await createOrganization(data);
      onClose();
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Complete Your Business Setup</DialogTitle>
          <DialogDescription>
            Let's set up your business account. We'll create a secure multisig wallet for your
            organization.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="business_name">Business Name *</Label>
            <Input
              id="business_name"
              {...register('business_name')}
              placeholder="Enter your business name"
            />
            {errors.business_name && (
              <p className="text-sm text-red-500">{errors.business_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="primary_address">Business Address *</Label>
            <Input
              id="primary_address"
              {...register('primary_address')}
              placeholder="Enter your business address"
            />
            {errors.primary_address && (
              <p className="text-sm text-red-500">{errors.primary_address.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">Country *</Label>
            <Input
              id="country"
              {...register('country')}
              placeholder="Enter country code (e.g., US)"
              maxLength={2}
            />
            {errors.country && <p className="text-sm text-red-500">{errors.country.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="business_email">Business Email *</Label>
            <Input
              id="business_email"
              {...register('business_email')}
              disabled={primaryEmailSameAsAdmin}
              placeholder="Enter business email"
            />
            <div className="flex items-center space-x-2">
              <Checkbox
                id="primaryEmailSameAsAdmin"
                checked={primaryEmailSameAsAdmin}
                onCheckedChange={handlePrimaryEmailToggle}
              />
              <Label htmlFor="primaryEmailSameAsAdmin" className="text-sm text-gray-600">
                Primary organization email same as admin
              </Label>
            </div>
            {errors.business_email && (
              <p className="text-sm text-red-500">{errors.business_email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="primary_phone">Business Phone (Optional)</Label>
            <Input
              id="primary_phone"
              {...register('primary_phone')}
              placeholder="Enter business phone"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={isCreating}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating} className="bg-blue-600 hover:bg-blue-700">
              {isCreating ? 'Creating Organization...' : 'Create Organization'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
