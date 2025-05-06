// pages/api/_services/repositories/organizationRepository.ts
import { supabaseAdmin } from '../../_config/supabase';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  type Organization,
} from '@/schemas/organization.schema';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/db/supabase';

export const organizationRepository = {
  // Add this new method to check if user already has an organization
  async isUserInAnyOrganization(
    supabase: SupabaseClient<Database>,
    userId: string,
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from('organization_members')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1);

    if (error) throw new Error(`Failed to check user organizations: ${error.message}`);

    return (data || []).length > 0;
  },

  // System-level operations
  async getByIdSystem(id: string): Promise<Organization> {
    const { data, error } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(`Failed to get organization: ${error.message}`);
    if (!data) throw new Error(`Organization not found: ${id}`);

    return data;
  },

  // RLS-respecting operations
  async getById(supabase: SupabaseClient<Database>, id: string): Promise<Organization> {
    const { data, error } = await supabase.from('organizations').select('*').eq('id', id).single();

    if (error) throw new Error(`Failed to get organization: ${error.message}`);
    if (!data) throw new Error(`Organization not found: ${id}`);

    return data;
  },

  async getByUserId(supabase: SupabaseClient<Database>, userId: string): Promise<Organization[]> {
    const { data, error } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) throw new Error(`Failed to get user organizations: ${error.message}`);
    if (!data || data.length === 0) return [];

    const orgIds = data.map((member) => member.organization_id);

    const { data: organizations, error: orgsError } = await supabase
      .from('organizations')
      .select('*')
      .in('id', orgIds);

    if (orgsError) throw new Error(`Failed to get organizations: ${orgsError.message}`);

    return organizations || [];
  },

  async create(
    supabase: SupabaseClient<Database>,
    organizationData: any,
    userId: string,
  ): Promise<Organization> {
    try {
      // Check if user is already in an organization
      const isAlreadyInOrg = await this.isUserInAnyOrganization(supabase, userId);
      if (isAlreadyInOrg) {
        throw new Error('User is already a member of an organization');
      }

      // Parse and validate with Zod
      const validData = createOrganizationSchema.parse({
        ...organizationData,
        verification_status: 'pending',
      });

      // Insert to database
      const { data, error } = await supabase
        .from('organizations')
        .insert({
          ...validData,
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create organization: ${error.message}`);
      if (!data) throw new Error('Failed to retrieve created organization');

      // Create member record
      await supabase.from('organization_members').insert({
        organization_id: data.id,
        user_id: userId,
        role: 'owner',
        status: 'active',
      });

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to create organization: ${String(error)}`);
    }
  },

  // Rest of the repository methods remain unchanged
  async update(
    supabase: SupabaseClient<Database>,
    id: string,
    organizationData: any,
  ): Promise<Organization> {
    try {
      // Validate with Zod
      const validData = updateOrganizationSchema.parse({
        id,
        ...organizationData,
      });

      const { data, error } = await supabase
        .from('organizations')
        .update(validData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(`Failed to update organization: ${error.message}`);
      if (!data) throw new Error(`Organization not found: ${id}`);

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to update organization: ${String(error)}`);
    }
  },

  async delete(supabase: SupabaseClient<Database>, id: string): Promise<void> {
    const { error } = await supabase.from('organizations').delete().eq('id', id);

    if (error) throw new Error(`Failed to delete organization: ${error.message}`);
  },

  async addMember(
    supabase: SupabaseClient<Database>,
    organizationId: string,
    userId: string,
    role: string,
  ): Promise<void> {
    // Check if user is already in an organization
    const isAlreadyInOrg = await this.isUserInAnyOrganization(supabase, userId);
    if (isAlreadyInOrg) {
      throw new Error('User is already a member of an organization');
    }

    const { error } = await supabase.from('organization_members').insert({
      organization_id: organizationId,
      user_id: userId,
      role,
      status: 'active',
    });

    if (error) throw new Error(`Failed to add member: ${error.message}`);
  },

  async removeMember(
    supabase: SupabaseClient<Database>,
    organizationId: string,
    userId: string,
  ): Promise<void> {
    const { error } = await supabase.from('organization_members').delete().match({
      organization_id: organizationId,
      user_id: userId,
    });

    if (error) throw new Error(`Failed to remove member: ${error.message}`);
  },

  async getMembers(supabase: SupabaseClient<Database>, organizationId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('organization_members')
      .select(
        `
        *,
        users:user_id (*)
      `,
      )
      .eq('organization_id', organizationId);

    if (error) throw new Error(`Failed to get members: ${error.message}`);

    return data || [];
  },

  // System-level operations needed during signup/bootstrap
  async createSystem(organizationData: any, userId: string): Promise<Organization> {
    try {
      // Check if user is already in an organization
      const { data: existingMemberships } = await supabaseAdmin
        .from('organization_members')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .limit(1);

      if (existingMemberships && existingMemberships.length > 0) {
        throw new Error('User is already a member of an organization');
      }

      // Parse and validate with Zod
      const validData = createOrganizationSchema.parse({
        ...organizationData,
        verification_status: 'pending',
      });

      // Insert to database
      const { data, error } = await supabaseAdmin
        .from('organizations')
        .insert({
          ...validData,
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create organization: ${error.message}`);
      if (!data) throw new Error('Failed to retrieve created organization');

      // Create member record
      await supabaseAdmin.from('organization_members').insert({
        organization_id: data.id,
        user_id: userId,
        role: 'owner',
        status: 'active',
      });

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to create organization: ${String(error)}`);
    }
  },
};
