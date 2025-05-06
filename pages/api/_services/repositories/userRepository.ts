// pages/api/_services/repositories/userRepository.ts
import { supabaseAdmin, createSupabaseClient, Database } from '../../_config/supabase';
import { createUserSchema, updateUserSchema, type User } from '@/schemas/user.schema';
import { SupabaseClient } from '@supabase/supabase-js';

export const userRepository = {
  // Regular operations (respects RLS)
  async getById(supabase: SupabaseClient<Database>, id: string): Promise<User> {
    const { data, error } = await supabase.from('users').select('*').eq('id', id).single();

    if (error) throw new Error(`Failed to get user: ${error.message}`);
    if (!data) throw new Error(`User not found: ${id}`);

    return data;
  },

  // System operation (uses admin client)
  async getByAuthIdSystem(authId: string): Promise<User | null> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('auth_id', authId)
      .maybeSingle();

    if (error) throw new Error(`Failed to get user by auth ID: ${error.message}`);
    return data;
  },

  // System operation (uses admin client)
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

  // System operation (for signup flow)
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

  // Regular operation (respects RLS)
  async update(supabase: SupabaseClient<Database>, id: string, userData: any): Promise<User> {
    try {
      const validData = updateUserSchema.parse({
        id,
        ...userData,
      });

      const { data, error } = await supabase
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

  // Regular operation (respects RLS)
  async getUserOrganizations(supabase: SupabaseClient<Database>, userId: string): Promise<any[]> {
    const { data, error } = await supabase
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
