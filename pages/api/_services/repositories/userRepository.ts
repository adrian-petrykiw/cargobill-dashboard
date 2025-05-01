// pages/api/_services/repositories/userRepository.ts
import { supabaseAdmin } from '../../_config/supabase';
import { createUserSchema, updateUserSchema, type User } from '@/schemas/user.schema';

export const userRepository = {
  async getById(id: string): Promise<User> {
    const { data, error } = await supabaseAdmin.from('users').select('*').eq('id', id).single();

    if (error) throw new Error(`Failed to get user: ${error.message}`);
    if (!data) throw new Error(`User not found: ${id}`);

    return data;
  },

  async getByAuthId(authId: string): Promise<User | null> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('auth_id', authId)
      .maybeSingle();

    if (error) throw new Error(`Failed to get user by auth ID: ${error.message}`);

    return data;
  },

  async getByEmail(email: string): Promise<User | null> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) throw new Error(`Failed to get user by email: ${error.message}`);

    return data;
  },

  async create(userData: any): Promise<User> {
    try {
      // Validate with Zod
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

  async update(id: string, userData: any): Promise<User> {
    try {
      // Validate with Zod
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

  async createUser(authId: string, userData: any): Promise<User> {
    // Check if user exists
    const existingUser = await this.getByAuthId(authId);

    if (existingUser) {
      return existingUser;
    }

    // Create new user
    return this.create({
      auth_id: authId,
      ...userData,
    });
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
