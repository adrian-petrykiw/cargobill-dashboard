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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  onboardingOrganizationSchema,
  OnboardingOrganizationRequest,
} from '@/schemas/organization.schema';
import { useOnboarding } from '@/hooks/useOnboarding';
import toast from 'react-hot-toast';
import { countryOptions } from '@/constants/countryData';
import { DialogClose } from '@radix-ui/react-dialog';
import { Info, CheckCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
  const [orgCreated, setOrgCreated] = useState(false);

  // Define form with useForm hook
  const form = useForm<OnboardingOrganizationRequest>({
    resolver: zodResolver(onboardingOrganizationSchema),
    defaultValues: {
      business_name: '',
      country: 'USA', // Default to USA
      business_email: userEmail,
    },
  });

  // Update business email when checkbox changes
  const handlePrimaryEmailToggle = (checked: boolean) => {
    setPrimaryEmailSameAsAdmin(checked);
    if (checked) {
      form.setValue('business_email', userEmail, { shouldValidate: true });
    }
  };

  // Form submission handler
  const onSubmit = async (data: OnboardingOrganizationRequest) => {
    try {
      await createOrganization(data);
      setOrgCreated(true);
      // Do NOT close the modal here - show success state instead
    } catch (error) {
      console.error('Failed to create organization: ', error);
      toast.error('Failed to create organization');
      // Modal stays open on failure
    }
  };

  // Handle continuing after successful creation
  const handleCloseWithSuccess = () => {
    toast.success('Account created successfully');
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        // Only allow closing if org was created or if opening
        if (!open) {
          if (orgCreated) {
            handleCloseWithSuccess();
          }
          // If org not created, do nothing (prevents dialog from closing)
          return;
        }
        // Allow opening
        return true;
      }}
    >
      <DialogContent
        className="sm:max-w-[600px] focus:outline-none focus:ring-0 focus:ring-offset-0 bg-white"
        // Override the default backdrop styles
        style={
          {
            '--tw-bg-opacity': '1',
            backgroundColor: 'white',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          } as React.CSSProperties
        }
      >
        <DialogHeader>
          <DialogTitle>Complete Your Account Setup</DialogTitle>
          <DialogDescription>
            Let's setup your business! We'll create a secure wallet for payment operations.
          </DialogDescription>
        </DialogHeader>
        {/* Only show close button if org was created */}
        {orgCreated && <DialogClose />}

        {orgCreated ? (
          <div className="space-y-6 py-4">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
              <h3 className="text-xl font-medium">Organization Created Successfully</h3>
              <p className="text-gray-500">
                Your business account has been set up. You can now start using CargoBill.
              </p>
            </div>
            <Button
              onClick={handleCloseWithSuccess}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              Continue to Dashboard
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Business Name Field */}
              <FormField
                control={form.control}
                name="business_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your business name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Country Field */}
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Country *</FormLabel>
                      <TooltipProvider delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent align="end" className="max-w-[260px] text-xs">
                            <p>
                              Select the country where this office is located. If you have offices
                              in multiple countries register each office as a seperate organization
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a country" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent side="bottom" align="center" position="popper" sideOffset={4}>
                        {countryOptions.map((country) => (
                          <SelectItem key={country.code} value={country.code}>
                            {country.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Business Email Field */}
              <FormField
                control={form.control}
                name="business_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Email *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter business email"
                        {...field}
                        disabled={primaryEmailSameAsAdmin}
                      />
                    </FormControl>
                    <div className="flex items-center space-x-2 pt-2">
                      <Checkbox
                        id="primaryEmailSameAsAdmin"
                        checked={primaryEmailSameAsAdmin}
                        onCheckedChange={handlePrimaryEmailToggle}
                      />
                      <FormLabel
                        htmlFor="primaryEmailSameAsAdmin"
                        className="text-sm text-gray-600 font-normal"
                      >
                        My email is the primary business email
                      </FormLabel>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex w-full justify-center pt-4">
                <Button type="submit" disabled={isCreating} className="w-full">
                  {isCreating ? 'Creating Organization...' : 'Create'}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
