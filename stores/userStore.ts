// stores/userStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import { User } from '@/schemas/user.schema';

interface UserState {
  user: User | null;
  isLoading: boolean;
  error: Error | null;

  // Actions
  setUser: (user: User | null) => void;
  fetchUser: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  clearUser: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: false,
      error: null,

      setUser: (user) => set({ user }),

      fetchUser: async () => {
        try {
          set({ isLoading: true, error: null });
          const { data } = await axios.get('/api/users/profile');
          if (data.success) {
            set({ user: data.data, isLoading: false });
          } else {
            throw new Error('Failed to fetch user profile');
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
          set({ error: error as Error, isLoading: false });
        }
      },

      updateUser: async (userData) => {
        try {
          set({ isLoading: true, error: null });
          const { data } = await axios.put('/api/users/profile', userData);
          if (data.success) {
            set({ user: data.data, isLoading: false });
          } else {
            throw new Error('Failed to update user profile');
          }
        } catch (error) {
          console.error('Error updating user profile:', error);
          set({ error: error as Error, isLoading: false });
          throw error;
        }
      },

      clearUser: () => {
        set({ user: null, error: null });
      },
    }),
    {
      name: 'user-storage',
      // Only persist non-sensitive data
      partialize: (state) => ({
        user: state.user
          ? {
              id: state.user.id,
              first_name: state.user.first_name,
              last_name: state.user.last_name,
              email: state.user.email,
            }
          : null,
      }),
    },
  ),
);
