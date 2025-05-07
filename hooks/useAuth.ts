// hooks/useAuth.ts
import { usePrivy, useLogin } from '@privy-io/react-auth';
import { useRouter } from 'next/router';
import { userApi } from '@/services/api/userApi';
import { ROUTES } from '@/constants/routes';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useUserStore } from '@/stores/userStore';

export default function useAuth() {
  const { logout: privyLogout, authenticated, ready, user: privyUser, getAccessToken } = usePrivy();
  const router = useRouter();
  const queryClient = useQueryClient();
  const setUser = useUserStore((state) => state.setUser);
  const clearUser = useUserStore((state) => state.clearUser);

  const { login } = useLogin({
    onComplete: async (params) => {
      try {
        const { user, isNewUser } = params;

        let firstName = '';
        let lastName = '';

        if (user.google?.name) {
          const nameParts = user.google.name.split(' ');
          firstName = nameParts[0] || '';
          lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
        }

        let userData;

        if (isNewUser) {
          userData = await userApi.registerUser({
            auth_id: user.id,
            email: user.email?.address || user.google?.email || '',
            first_name: firstName,
            last_name: lastName,
            wallet_address: user.wallet?.address || '',
          });

          setUser(userData);
        } else {
          userData = await userApi.loginUser({
            auth_id: user.id,
            email: user.email?.address || user.google?.email,
            wallet_address: user.wallet?.address,
          });

          setUser(userData);
        }

        queryClient.invalidateQueries({ queryKey: ['userProfile'] });
        queryClient.invalidateQueries({ queryKey: ['userOrganizations'] });

        router.push(ROUTES.DASHBOARD);
      } catch (error) {
        console.error('Error during authentication:', error);
        toast.error('Authentication failed. Please try again.');
      }
    },
  });

  const verifyServerAuth = async () => {
    const token = await getAccessToken();
    if (!token) return { authenticated: false };

    try {
      const response = await fetch('/api/auth/verify', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return { authenticated: false };
      }

      const result = await response.json();
      return {
        authenticated: result.success && result.data?.authenticated,
        userId: result.data?.userId,
      };
    } catch (error) {
      console.error('Authentication verification failed:', error);
      return { authenticated: false };
    }
  };

  const logout = async () => {
    // Clear Zustand store
    clearUser();

    // Clear React Query cache
    queryClient.clear();

    // Logout from Privy
    await privyLogout();

    // Redirect to signin
    router.push(ROUTES.AUTH.SIGNIN);
  };

  return {
    login,
    logout,
    authenticated,
    ready,
    privyUser,
    getToken: getAccessToken,
    verifyServerAuth,
  };
}
