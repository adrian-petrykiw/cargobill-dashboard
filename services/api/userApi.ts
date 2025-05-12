// services/api/userApi.ts
import axios from 'axios';
import type { User, UpdateProfileRequest, CreateUserRequest } from '@/schemas/user.schema';
import type { ApiResponse } from '@/types/api/responses';

type LoginRequest = {
  auth_id: string;
  email?: string;
  wallet_address?: string;
};

export const userApi = {
  // Profile Management
  async getCurrentUser(): Promise<User | null> {
    try {
      const { data } = await axios.get<ApiResponse<User>>('/api/users/profile');
      if (!data.success) throw new Error(data.error?.message || 'Failed to fetch user profile');
      return data.data || null;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
        throw new Error(error.response.data.error.message);
      }
      throw new Error('Failed to fetch user profile. Please try again later.');
    }
  },

  async updateProfile(profile: UpdateProfileRequest): Promise<User> {
    try {
      const { data } = await axios.put<ApiResponse<User>>('/api/users/profile', profile);
      if (!data.success) throw new Error(data.error?.message || 'Failed to update profile');
      return data.data!;
    } catch (error) {
      console.error('Error updating user profile:', error);
      if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
        throw new Error(error.response.data.error.message);
      }
      throw new Error('Failed to update profile. Please try again later.');
    }
  },

  // Authentication
  async registerUser(userData: CreateUserRequest): Promise<User> {
    try {
      const { data } = await axios.post<ApiResponse<User>>('/api/auth/registerUser', userData);

      if (!data.success) throw new Error(data.error?.message || 'Failed to register user');
      return data.data!;
    } catch (error) {
      console.error('Registration error details:', error);
      if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
        throw new Error(error.response.data.error.message);
      }
      throw new Error('Registration failed. Please try again later.');
    }
  },

  async loginUser(credentials: LoginRequest): Promise<User> {
    try {
      const { data } = await axios.post<ApiResponse<User>>('/api/auth/loginUser', credentials);
      if (!data.success) throw new Error(data.error?.message || 'Failed to login user');
      return data.data!;
    } catch (error) {
      console.error('Login error details:', error);
      if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
        throw new Error(error.response.data.error.message);
      }
      throw new Error('Login failed. Please check your credentials and try again.');
    }
  },

  checkUserExists: async ({
    auth_id,
    email,
  }: {
    auth_id: string;
    email: string;
  }): Promise<boolean> => {
    if (!auth_id || !email) {
      throw new Error('Both auth_id and email are required');
    }

    try {
      console.log('Making API call to check if user exists:', { auth_id, email });
      const { data } = await axios.post<ApiResponse<{ exists: boolean }>>('/api/users/exists', {
        auth_id,
        email,
      });

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to check user existence');
      }

      console.log('User exists API response:', data);
      return data.data?.exists || false;
    } catch (error) {
      console.error('API error checking user existence:', error);
      if (axios.isAxiosError(error) && error.response?.data?.error?.message) {
        throw new Error(error.response.data.error.message);
      }
      throw new Error('Failed to verify user existence. Please try again later.');
    }
  },
};
