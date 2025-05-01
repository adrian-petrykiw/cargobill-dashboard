// hooks/useUserProfile.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePrivy } from '@privy-io/react-auth';
import { userApi } from '@/services/api/userApi';
import { toast } from 'react-hot-toast';
import type { User, UpdateProfileRequest } from '@/schemas/user.schema';

export function useUserProfile() {
  const queryClient = useQueryClient();
  const { user: privyUser } = usePrivy();

  const profileQuery = useQuery<User>({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const data = await userApi.getCurrentUser();
      if (!data) throw new Error('Failed to fetch user profile');
      return data;
    },
  });

  const updateProfile = useMutation({
    mutationFn: async (profileData: UpdateProfileRequest) => {
      return await userApi.updateProfile(profileData);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['userProfile'], data);
      toast.success('Profile updated successfully');
    },
    onError: (error) => {
      console.error('Profile update error:', error);
      toast.error('Failed to update profile');
    },
  });

  // Get email from Privy
  const getEmail = () => {
    if (privyUser?.email?.address) {
      return privyUser.email.address;
    }
    if (privyUser?.google?.email) {
      return privyUser.google.email;
    }
    return profileQuery.data?.email || '';
  };

  // Get user's name from various sources
  const getUserName = () => {
    // First try profile data
    if (profileQuery.data?.first_name) {
      return {
        firstName: profileQuery.data.first_name,
        lastName: profileQuery.data.last_name || '',
      };
    }

    // Then try Privy Google data
    if (privyUser?.google?.name) {
      const nameParts = privyUser.google.name.split(' ');
      if (nameParts.length > 1) {
        return {
          firstName: nameParts[0],
          lastName: nameParts.slice(1).join(' '),
        };
      } else {
        return {
          firstName: privyUser.google.name,
          lastName: '',
        };
      }
    }

    // Default
    return {
      firstName: '',
      lastName: '',
    };
  };

  return {
    profile: profileQuery.data,
    isLoading: profileQuery.isLoading,
    error: profileQuery.error,
    updateProfile: updateProfile.mutate,
    isUpdating: updateProfile.isPending,
    getEmail,
    getUserName,
    refetch: profileQuery.refetch,
  };
}
