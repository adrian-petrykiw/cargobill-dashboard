// pages/api/_services/repositories/userRepository.ts
import { supabaseAdmin } from '../../_config/supabase';
import { createUserSchema, updateUserSchema, type User } from '@/schemas/user.schema';

export const userRepository = {
  async getById(id: unknown): Promise<User> {
    if (!id) {
      throw new Error('User ID is required but was undefined or empty');
    }

    if (typeof id !== 'string') {
      throw new Error(`Invalid ID type: ${typeof id}, value: ${JSON.stringify(id)}`);
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error(`Database error fetching user ${id}:`, error);
      throw new Error(`Failed to get user: ${error.message}`);
    }

    if (!data) {
      throw new Error(`User not found with ID: ${id}`);
    }

    return data;
  },

  async getByAuthIdSystem(authId: string): Promise<User | null> {
    if (!authId) {
      throw new Error('Auth ID is required but was undefined or empty');
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('auth_id', authId)
      .maybeSingle();

    if (error) throw new Error(`Failed to get user by auth ID: ${error.message}`);
    return data;
  },

  async getUserByEmail(email: string): Promise<User | null> {
    if (!email) {
      throw new Error('Email is required but was undefined or empty');
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) throw new Error(`Failed to get user by email: ${error.message}`);
    return data;
  },

  async getUserByWallet(walletAddress: string): Promise<User | null> {
    if (!walletAddress) {
      throw new Error('Wallet address is required but was undefined or empty');
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('wallet_address', walletAddress)
      .maybeSingle();

    if (error) throw new Error(`Failed to get user by wallet address: ${error.message}`);
    return data;
  },

  async create(userData: any): Promise<User> {
    try {
      const validData = createUserSchema.parse(userData);

      const { data, error } = await supabaseAdmin.from('users').insert(validData).select().single();

      if (error) throw new Error(`Failed to create user: ${error.message}`);
      if (!data) throw new Error('Failed to retrieve created user');

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to create user: ${String(error)}`);
    }
  },

  async createUser(authId: string, userData: any): Promise<User> {
    const existingUser = await this.getByAuthIdSystem(authId);

    if (existingUser) {
      return existingUser;
    }

    return this.create({
      auth_id: authId,
      ...userData,
    });
  },

  // API operation (now uses admin client)
  async update(id: string, userData: any): Promise<User> {
    try {
      const validData = updateUserSchema.parse({
        id,
        ...userData,
      });

      const { data, error } = await supabaseAdmin
        .from('users')
        .update(validData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(`Failed to update user: ${error.message}`);
      if (!data) throw new Error(`User not found: ${id}`);

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to update user: ${String(error)}`);
    }
  },

  async getUserOrganizations(userId: string): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('organization_members')
      .select(
        `
        *,
        organizations:organization_id (*)
      `,
      )
      .eq('user_id', userId);

    if (error) throw new Error(`Failed to get user organizations: ${error.message}`);

    return data || [];
  },
};
