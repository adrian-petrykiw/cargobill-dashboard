// features/auth/hooks/useAuth.ts
import { useRouter } from 'next/router';
import { usePrivy } from '@privy-io/react-auth';
import { ROUTES } from '@/constants/routes';

console.log('useAuth hook loaded');

export default function useAuth() {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  const router = useRouter();

  const handleLogin = async () => {
    login();
  };

  const handleLogout = async () => {
    await logout();
    router.push(ROUTES.AUTH.SIGNIN);
  };

  const verifyServerAuth = async () => {
    const token = await getAccessToken();
    if (!token) return null;

    try {
      const response = await fetch('/api/auth/verify', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to verify authentication');
      }

      return await response.json();
    } catch (error) {
      console.error('Authentication verification failed:', error);
      return null;
    }
  };

  return {
    isReady: ready,
    isAuthenticated: authenticated,
    user,
    login: handleLogin,
    logout: handleLogout,
    getToken: getAccessToken,
    verifyServerAuth,
  };
}
