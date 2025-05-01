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

import { countryOptions } from '@/constants/countryData';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pencil } from 'lucide-react';
import Spinner from '@/components/common/Spinner';
import { SelectTimezone } from '@/components/SelectTimezone';

interface Country {
  code: string;
  name: string;
}

export default function ProfileTab() {
  const { profile, isLoading, updateProfile, isUpdating, getEmail } = useUserProfile();
  const [isEditing, setIsEditing] = useState(false);

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

  // Show loading spinner
  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Spinner size="lg" />
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
              <div className="grid grid-cols-2 py-2 px-6">
                <div className="text-sm text-gray-500">Email address</div>
                <div className="text-sm">{getEmail()}</div>
              </div>

              <div className="grid grid-cols-2 py-2 px-6">
                <div className="text-sm text-gray-500">First Name</div>
                <div className="text-sm">{profile?.first_name || 'Not provided'}</div>
              </div>

              <div className="grid grid-cols-2 py-2 px-6">
                <div className="text-sm text-gray-500">Last Name</div>
                <div className="text-sm">{profile?.last_name || 'Not provided'}</div>
              </div>

              <div className="grid grid-cols-2 py-2 px-6">
                <div className="text-sm text-gray-500">Phone number</div>
                <div className="text-sm">{profile?.phone_number || 'Not provided'}</div>
              </div>

              <div className="grid grid-cols-2 py-2 px-6">
                <div className="text-sm text-gray-500">Timezone</div>
                <div className="text-sm">{profile?.timezone || 'Not provided'}</div>
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
                    'Not provided'
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 py-2 px-6">
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
                    'Not provided'
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
