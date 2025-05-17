// features/settings/components/ProfileTab.tsx
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useUserProfile } from '@/hooks/useUserProfile';
import { updateProfileSchema, type UpdateProfileRequest } from '@/schemas/user.schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

import { countryOptions } from '@/constants/countryData';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pencil, KeyRound, AlertTriangle, ExternalLink } from 'lucide-react';
import Spinner from '@/components/common/Spinner';
import { SelectTimezone } from '@/components/SelectTimezone';
// Add Privy imports
import { usePrivy, type WalletWithMetadata } from '@privy-io/react-auth';
import { useSolanaWallets } from '@privy-io/react-auth/solana';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Country {
  code: string;
  name: string;
}

export default function ProfileTab() {
  const { profile, isLoading, updateProfile, isUpdating, getEmail } = useUserProfile();
  const [isEditing, setIsEditing] = useState(false);
  // Add Privy hooks
  const { ready: privyReady, authenticated, user } = usePrivy();
  const { wallets, ready: walletsReady, exportWallet } = useSolanaWallets();

  const form = useForm<UpdateProfileRequest>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      phone_number: '',
      timezone: '',
      primary_address: {
        street1: '',
        street2: '',
        city: '',
        state: '',
        postal_code: '',
        country: '',
      },
      mailing_address: {
        street1: '',
        street2: '',
        city: '',
        state: '',
        postal_code: '',
        country: '',
      },
      profile_image_url: '',
    },
  });

  // Update form when edit mode is activated
  useEffect(() => {
    if (profile && isEditing) {
      form.reset({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        phone_number: profile.phone_number || '',
        timezone: profile.timezone || '',
        primary_address: profile.primary_address || {
          street1: '',
          street2: '',
          city: '',
          state: '',
          postal_code: '',
          country: '',
        },
        mailing_address: profile.mailing_address || {
          street1: '',
          street2: '',
          city: '',
          state: '',
          postal_code: '',
          country: '',
        },
        profile_image_url: profile.profile_image_url || '',
      });
    }
  }, [profile, isEditing, form]);

  const onSubmit = async (data: UpdateProfileRequest) => {
    try {
      await updateProfile(data);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  // Get embedded wallet from the wallets array (connected wallets)
  const embeddedWallet = walletsReady
    ? wallets.find((wallet) => wallet.walletClientType === 'privy')
    : undefined;

  // Check if user has an embedded Solana wallet (both connected and linked)
  const isAuthenticated = privyReady && authenticated;
  const hasLinkedEmbeddedWallet =
    isAuthenticated &&
    user?.linkedAccounts?.some(
      (account): account is WalletWithMetadata =>
        account.type === 'wallet' &&
        account.walletClientType === 'privy' &&
        account.chainType === 'solana',
    );

  // Handle wallet export with address (if multiple wallets exist)
  const handleExportWallet = () => {
    if (embeddedWallet) {
      exportWallet({ address: embeddedWallet.address });
    } else {
      // If no connected wallet is found but we know they have a linked wallet,
      // just call exportWallet without address and let Privy handle it
      exportWallet();
    }
  };

  // Show skeleton loading UI
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Skeleton className="w-12 h-12 rounded-md" />
            <Skeleton className="h-6 w-40" />
          </div>
          <Skeleton className="h-9 w-20" />
        </div>

        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-6 w-full" />
                </div>
                <div>
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-6 w-full" />
                </div>
              </div>
              <div>
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-6 w-full" />
              </div>
              <div>
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-6 w-full" />
              </div>
              <div>
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-6 w-full" />
              </div>

              <Separator className="my-6" />

              <Skeleton className="h-6 w-40 mb-4" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-6 w-full" />
                </div>
                <div>
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-6 w-full" />
                </div>
                <div>
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-6 w-full" />
                </div>
                <div>
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-6 w-full" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get user initials for avatar
  const getInitials = () => {
    if (!profile) return 'U';
    const email = getEmail();
    const firstLetter = email && email.length > 0 ? email[0].toUpperCase() : '';
    return firstLetter || 'U';
  };

  // Get country name from code
  const getCountryName = (code: string) => {
    const country = countryOptions.find((c) => c.code === code);
    return country ? country.name : code;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-md bg-slate-800 text-white text-xl font-semibold">
            {getInitials()}
          </div>
          <span className="text-lg font-medium">
            {profile ? `${profile.first_name} ${profile.last_name}` : 'User Profile'}
          </span>
        </div>
        {!isEditing && (
          <Button
            className="bg-background hover:bg-secondary"
            variant="ghost"
            onClick={() => setIsEditing(true)}
          >
            Edit <Pencil className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {isEditing ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="first_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} placeholder="First Name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="last_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} placeholder="Last Name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input
                      value={getEmail()}
                      disabled
                      placeholder="Email is managed by authentication provider"
                    />
                  </FormControl>
                </FormItem>

                <FormField
                  control={form.control}
                  name="phone_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} placeholder="Phone Number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="timezone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timezone</FormLabel>
                      <FormControl>
                        <SelectTimezone value={field.value || ''} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="profile_image_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Profile Image URL</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ''}
                          placeholder="https://example.com/avatar.jpg"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator className="my-6" />

                <h3 className="text-lg font-medium">Primary Address</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="primary_address.street1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Street Address</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} placeholder="123 Main St" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="primary_address.street2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Apt/Suite</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} placeholder="Apt 4B" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="primary_address.city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} placeholder="New York" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="primary_address.state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State/Province</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} placeholder="NY" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="primary_address.postal_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postal Code</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} placeholder="10001" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="primary_address.country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <Select value={field.value || ''} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a country" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {countryOptions.map((country: Country) => (
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
                </div>

                <Separator className="my-6" />

                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Mailing Address</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const primaryAddress = form.getValues('primary_address');
                      form.setValue('mailing_address', primaryAddress);
                    }}
                  >
                    Same as Primary
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="mailing_address.street1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Street Address</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} placeholder="123 Main St" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mailing_address.street2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Apt/Suite</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} placeholder="Apt 4B" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mailing_address.city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} placeholder="New York" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mailing_address.state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State/Province</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} placeholder="NY" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mailing_address.postal_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postal Code</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} placeholder="10001" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mailing_address.country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <Select value={field.value || ''} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a country" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {countryOptions.map((country: Country) => (
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
                </div>

                <div className="flex justify-end gap-4 pt-6 border-t mt-6">
                  <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating ? <Spinner size="sm" className="mr-2" /> : null}
                    Save Changes
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <div className="divide-y">
              <div className="grid grid-cols-2 pb-2 px-6">
                <div className="text-sm text-gray-500">Email address</div>
                <div className="text-sm">{getEmail()}</div>
              </div>

              <div className="grid grid-cols-2 py-2 px-6">
                <div className="text-sm text-gray-500">First Name</div>
                <div className="text-sm">{profile?.first_name || '-'}</div>
              </div>

              <div className="grid grid-cols-2 py-2 px-6">
                <div className="text-sm text-gray-500">Last Name</div>
                <div className="text-sm">{profile?.last_name || '-'}</div>
              </div>

              <div className="grid grid-cols-2 py-2 px-6">
                <div className="text-sm text-gray-500">Phone number</div>
                <div className="text-sm">{profile?.phone_number || '-'}</div>
              </div>

              <div className="grid grid-cols-2 py-2 px-6">
                <div className="text-sm text-gray-500">Timezone</div>
                <div className="text-sm">{profile?.timezone || '-'}</div>
              </div>

              <div className="grid grid-cols-2 py-2 px-6">
                <div className="text-sm text-gray-500">Primary address</div>
                <div className="text-sm">
                  {profile?.primary_address?.street1 ? (
                    <>
                      {profile.primary_address.street1}
                      {profile.primary_address.street2 && <>, {profile.primary_address.street2}</>}
                      <br />
                      {profile.primary_address.city}, {profile.primary_address.state}{' '}
                      {profile.primary_address.postal_code}
                      <br />
                      {profile.primary_address.country &&
                        getCountryName(profile.primary_address.country)}
                    </>
                  ) : (
                    '-'
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 pt-2 px-6">
                <div className="text-sm text-gray-500">Mailing Address</div>
                <div className="text-sm">
                  {profile?.mailing_address?.street1 ? (
                    <>
                      {profile.mailing_address.street1}
                      {profile.mailing_address.street2 && <>, {profile.mailing_address.street2}</>}
                      <br />
                      {profile.mailing_address.city}, {profile.mailing_address.state}{' '}
                      {profile.mailing_address.postal_code}
                      <br />
                      {profile.mailing_address.country &&
                        getCountryName(profile.mailing_address.country)}
                    </>
                  ) : (
                    '-'
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Wallet Export Card */}
      <Card className="shadow-sm">
        {/* <CardHeader>
          <CardTitle className="flex items-center text-lg font-medium">
            <KeyRound className="mr-2 h-5 w-5" />
            Wallet Security
          </CardTitle>
        </CardHeader> */}
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* <p className="text-sm text-gray-600">
              Your CargoBill account uses a Solana blockchain wallet to securely process payments
              and manage transactions. You can export your wallet's private key for backup or to use
              with external wallet providers like Phantom.
            </p> */}

            {walletsReady ? (
              hasLinkedEmbeddedWallet || embeddedWallet ? (
                <>
                  <div className="py-2">
                    <div className="text-sm text-gray-500 mb-1">Wallet Address</div>
                    <div className="flex items-center">
                      <code className="text-xs bg-gray-100 p-2 rounded font-mono w-full overflow-hidden text-ellipsis">
                        {embeddedWallet?.address || 'Wallet address will be shown when connected'}
                      </code>
                    </div>
                  </div>

                  <div className="flex items-center p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
                    <div className="text-sm text-yellow-700">
                      Your private key provides complete access to your funds. Never share it with
                      anyone.
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      onClick={handleExportWallet}
                      className="bg-slate-800 hover:bg-slate-900 text-white"
                    >
                      Export Wallet Private Key
                    </Button>
                    {/* <Button
                      variant="outline"
                      onClick={() => window.open('https://phantom.app/', '_blank')}
                      className="flex items-center"
                    >
                      Phantom Wallet <ExternalLink className="ml-1 h-4 w-4" />
                    </Button> */}
                  </div>

                  <p className="text-xs text-gray-500 mt-2">
                    Note: CargoBill only supports exporting Solana wallets by private key, not seed
                    phrase, to ensure that you maintain the same address.
                  </p>
                </>
              ) : (
                <Alert>
                  <AlertTitle>No Embedded Wallet Found</AlertTitle>
                  <AlertDescription>
                    You don't have an embedded Solana wallet associated with your account. Please
                    contact support if you believe this is an error.
                  </AlertDescription>
                </Alert>
              )
            ) : (
              <div className="flex items-center justify-center p-4">
                <Spinner className="mr-2" size="sm" />
                <span className="text-sm">Loading wallet information...</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
