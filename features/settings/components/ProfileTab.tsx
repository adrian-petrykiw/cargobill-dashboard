// components/settings/ProfileTab.tsx
import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil } from 'lucide-react';

// Form schema for profile data
const profileSchema = z.object({
  legalName: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  residentialAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  mailingAddress: z.string().optional(),
  passport: z.any().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function ProfileTab() {
  const { user } = usePrivy();
  const [isEditing, setIsEditing] = useState(false);

  // Pre-fill form with user data from Privy if available
  const defaultValues = {
    legalName: user?.google?.email || '',
    email: user?.email?.address || user?.google?.email || 'NA',
    phone: 'NA',
    dateOfBirth: 'NA',
    residentialAddress: 'NA',
    city: 'NA',
    state: 'NA',
    zipCode: 'NA',
    country: 'NA',
    mailingAddress: 'NA',
    passport: 'andrew_peters_passport.pdf',
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues,
  });

  const onSubmit = async (data: ProfileFormData) => {
    try {
      // In a real implementation, you would save this data to your backend
      console.log('Saving profile data:', data);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving profile:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-md bg-slate-800 text-white text-xl font-semibold">
            AP
          </div>
          <span className="text-lg font-medium">Andrew Peters</span>
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
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
              <div className="space-y-6">
                <div className="space-y-1">
                  <Label htmlFor="email" className="text-sm text-gray-500">
                    Email address
                  </Label>
                  <Input
                    id="email"
                    className="border-gray-300"
                    type="email"
                    {...register('email')}
                  />
                  {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="legalName" className="text-sm text-gray-500">
                    Legal Name
                  </Label>
                  <Input id="legalName" className="border-gray-300" {...register('legalName')} />
                  {errors.legalName && (
                    <p className="text-sm text-red-500">{errors.legalName.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="dateOfBirth" className="text-sm text-gray-500">
                    Date of Birth
                  </Label>
                  <Input
                    id="dateOfBirth"
                    className="border-gray-300"
                    {...register('dateOfBirth')}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="phone" className="text-sm text-gray-500">
                    Phone number
                  </Label>
                  <Input id="phone" className="border-gray-300" {...register('phone')} />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="residentialAddress" className="text-sm text-gray-500">
                    Residential address
                  </Label>
                  <Input
                    id="residentialAddress"
                    className="border-gray-300"
                    {...register('residentialAddress')}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="city" className="text-sm text-gray-500">
                      City
                    </Label>
                    <Input id="city" className="border-gray-300" {...register('city')} />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="state" className="text-sm text-gray-500">
                      State
                    </Label>
                    <Input id="state" className="border-gray-300" {...register('state')} />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="zipCode" className="text-sm text-gray-500">
                      ZIP Code
                    </Label>
                    <Input id="zipCode" className="border-gray-300" {...register('zipCode')} />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="country" className="text-sm text-gray-500">
                    Country
                  </Label>
                  <Input id="country" className="border-gray-300" {...register('country')} />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="mailingAddress" className="text-sm text-gray-500">
                    Mailing Address
                  </Label>
                  <Input
                    id="mailingAddress"
                    className="border-gray-300"
                    {...register('mailingAddress')}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="passport" className="text-sm text-gray-500">
                    Passport
                  </Label>
                  <div className="flex items-center space-x-2">
                    <Input id="passport" className="border-gray-300" type="file" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button variant="outline" type="button" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="divide-y">
              <div className="grid grid-cols-2 py-2 px-6">
                <div className="text-sm text-gray-500">Email address</div>
                <div className="text-sm">{defaultValues.email}</div>
              </div>

              <div className="grid grid-cols-2 py-2 px-6">
                <div className="text-sm text-gray-500">Beneficial Owner Title</div>
                <div className="text-sm">Owner</div>
              </div>

              <div className="grid grid-cols-2 py-2 px-6">
                <div className="text-sm text-gray-500">Legal Name</div>
                <div className="text-sm">{defaultValues.legalName}</div>
              </div>

              <div className="grid grid-cols-2 py-2 px-6">
                <div className="text-sm text-gray-500">Date of Birth</div>
                <div className="text-sm">{defaultValues.dateOfBirth}</div>
              </div>

              <div className="grid grid-cols-2 py-2 px-6">
                <div className="text-sm text-gray-500">Phone number</div>
                <div className="text-sm">{defaultValues.phone}</div>
              </div>

              <div className="grid grid-cols-2 py-2 px-6">
                <div className="text-sm text-gray-500">Residential address</div>
                <div className="text-sm">
                  {defaultValues.residentialAddress}
                  <br />
                  {defaultValues.city}, {defaultValues.state} {defaultValues.zipCode}
                  <br />
                  {defaultValues.country}
                </div>
              </div>

              <div className="grid grid-cols-2 py-2 px-6">
                <div className="text-sm text-gray-500">Mailing Address</div>
                <div className="text-sm">{defaultValues.mailingAddress}</div>
              </div>

              <div className="grid grid-cols-2 py-2 px-6">
                <div className="text-sm text-gray-500">Passport</div>
                <div className="flex items-center space-x-2">
                  <span className="flex items-center text-sm">
                    <svg
                      className="h-4 w-4 mr-1"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
                        stroke="black"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M14 2V8H20"
                        stroke="black"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M16 13H8"
                        stroke="black"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M16 17H8"
                        stroke="black"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M10 9H9H8"
                        stroke="black"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {defaultValues.passport}
                  </span>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                    <svg
                      className="h-3 w-3"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15"
                        stroke="black"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M7 10L12 15L17 10"
                        stroke="black"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M12 15V3"
                        stroke="black"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
