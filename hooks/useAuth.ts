// hooks/useAuth.ts
import { usePrivy, useLogin, User } from '@privy-io/react-auth';
import type { LinkedAccountWithMetadata } from '@privy-io/react-auth';
import { LoginMethod } from '@/types/privy';
import { useRouter } from 'next/router';
import { userApi } from '@/services/api/userApi';
import { ROUTES } from '@/constants/routes';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useUserStore } from '@/stores/userStore';
import { useState, useCallback } from 'react';

export default function useAuth() {
  const { logout: privyLogout, authenticated, ready, user: privyUser, getAccessToken } = usePrivy();
  const router = useRouter();
  const queryClient = useQueryClient();
  const setUser = useUserStore((state) => state.setUser);
  const clearUser = useUserStore((state) => state.clearUser);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);

  // Check if user exists in our database
  const checkUserExists = async (authId: string, email: string): Promise<boolean> => {
    if (!authId || !email) {
      console.error('Auth ID and email are required for user existence check');
      return false;
    }

    try {
      console.log('Checking if user exists:', { authId, email });
      return await userApi.checkUserExists({
        auth_id: authId,
        email: email,
      });
    } catch (error) {
      console.error('Error checking if user exists:', error);
      throw new Error('Failed to verify user existence');
    }
  };

  // Handle auth completion - determine signup/signin automatically
  const handleAuthComplete = useCallback(
    async (params: {
      user: User;
      isNewUser: boolean;
      wasAlreadyAuthenticated: boolean;
      loginMethod: LoginMethod | null;
      loginAccount: LinkedAccountWithMetadata | null;
    }) => {
      const { user, isNewUser } = params;
      setIsCheckingAuth(true);

      try {
        // Extract email, preferring OAuth provider emails if available
        const email = user.email?.address || user.google?.email || '';
        const authId = user.id;

        if (!email || !authId) {
          toast.error('Missing user information. Please try again.');
          await privyLogout();
          setIsCheckingAuth(false);
          return;
        }

        // Check if user exists in our database
        let userExists;
        try {
          userExists = await checkUserExists(authId, email);
          console.log('User exists check result:', userExists);
        } catch (error) {
          console.error('Failed to verify user in database:', error);
          toast.error('Authentication system error. Please try again later.');
          await privyLogout();
          setIsCheckingAuth(false);
          return;
        }

        // Automatically determine if we're signing up or logging in
        // User exists -> login flow
        // User doesn't exist -> signup flow
        const effectivelySigningUp = !userExists;
        console.log(
          `User ${userExists ? 'exists' : 'does not exist'}, treating as ${effectivelySigningUp ? 'signup' : 'signin'}`,
        );

        let firstName = '';
        let lastName = '';

        if (user.google?.name) {
          const nameParts = user.google.name.split(' ');
          firstName = nameParts[0] || '';
          lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
        }

        let userData;

        try {
          // Call the appropriate API endpoint based on whether user exists
          if (effectivelySigningUp) {
            console.log('Registering new user');

            userData = await userApi.registerUser({
              auth_id: user.id,
              email: email,
              first_name: firstName,
              last_name: lastName,
              wallet_address: user.wallet?.address || '',
            });

            // After successful registration, clear any cached queries
            queryClient.clear();

            // Additional verification that user was registered properly
            // This is important to ensure DB operations completed
            const verifyRegistration = await checkUserExists(authId, email);
            if (!verifyRegistration) {
              console.warn('User registration verification failed - retrying...');
              // Wait a second and try checking again
              await new Promise((resolve) => setTimeout(resolve, 1000));
              const secondAttempt = await checkUserExists(authId, email);
              if (!secondAttempt) {
                throw new Error('User registration did not complete successfully');
              }
            }

            toast.success('Account created successfully!');
          } else {
            console.log('Logging in existing user');
            userData = await userApi.loginUser({
              auth_id: user.id,
              email: email,
              wallet_address: user.wallet?.address || '',
            });
            toast.success('Logged in successfully!');
          }

          // Update local state with user data
          setUser(userData);

          // Added delay before redirect and query invalidation
          // This is critical to ensure user registration propagates to database
          setTimeout(() => {
            // Important: Invalidate queries after redirecting to dashboard
            // and ensure sufficient delay for registration to complete
            router.push(ROUTES.DASHBOARD).then(() => {
              setTimeout(() => {
                // Re-fetch user profile and organizations after redirect
                queryClient.invalidateQueries({ queryKey: ['userProfile'] });
                queryClient.invalidateQueries({ queryKey: ['userOrganizations'] });
                setIsCheckingAuth(false);
              }, 500);
            });
          }, 1500);
        } catch (error) {
          console.error('Error during authentication with backend:', error);
          toast.error('Authentication failed with our system. Please try again.');
          await privyLogout();
          setIsCheckingAuth(false);
        }
      } catch (error) {
        console.error('Error during authentication flow:', error);
        toast.error('Authentication failed. Please try again.');
        await privyLogout();
        setIsCheckingAuth(false);
      }
    },
    [privyLogout, router, setUser, queryClient],
  );

  // Set up useLogin hook with the callback
  const { login: privyLogin } = useLogin({
    onComplete: handleAuthComplete,
    onError: (error) => {
      console.error('Privy login error:', error);
      toast.error('Authentication failed. Please try again.');
      setIsCheckingAuth(false);
    },
  });

  // The isSignUp parameter is kept for backward compatibility
  // but we now determine signup/signin automatically based on user existence
  const login = useCallback(
    (isSignUp = false) => {
      return () => {
        setIsSigningUp(isSignUp); // This is now mostly for logging purposes
        setIsCheckingAuth(true);
        privyLogin();
      };
    },
    [privyLogin],
  );

  const verifyServerAuth = async () => {
    // Don't verify if we're already checking auth state
    if (isCheckingAuth) return { authenticated: false };

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
    clearUser();
    queryClient.clear();
    await privyLogout();
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
    isCheckingAuth,
  };
}
