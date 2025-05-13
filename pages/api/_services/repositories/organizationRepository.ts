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
  async isUserInAnyOrganization(userId: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin
      .from('organization_members')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1);

    if (error) throw new Error(`Failed to check user organizations: ${error.message}`);

    return (data || []).length > 0;
  },

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

  async getById(id: string): Promise<Organization> {
    const { data, error } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(`Failed to get organization: ${error.message}`);
    if (!data) throw new Error(`Organization not found: ${id}`);

    return data;
  },

  async getByUserId(userId: string): Promise<Organization[]> {
    const { data, error } = await supabaseAdmin
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) throw new Error(`Failed to get user organizations: ${error.message}`);
    if (!data || data.length === 0) return [];

    const orgIds = data.map((member) => member.organization_id);

    const { data: organizations, error: orgsError } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .in('id', orgIds);

    if (orgsError) throw new Error(`Failed to get organizations: ${orgsError.message}`);

    return organizations || [];
  },

  async create(organizationData: any, userId: string): Promise<Organization> {
    try {
      const isAlreadyInOrg = await this.isUserInAnyOrganization(userId);
      if (isAlreadyInOrg) {
        throw new Error('User is already a member of an organization');
      }

      console.log('Creating organization with data:', {
        ...organizationData,
        operational_wallet: organizationData.operational_wallet
          ? {
              type: organizationData.operational_wallet.type,
              status: organizationData.operational_wallet.status,
              address: organizationData.operational_wallet.address?.substring(0, 8) + '...',
              create_key: organizationData.operational_wallet.create_key?.substring(0, 8) + '...',
            }
          : null,
      });

      const validData = createOrganizationSchema.parse(organizationData);

      console.log('Validated organization data:', {
        ...validData,
        operational_wallet: validData.operational_wallet
          ? {
              type: validData.operational_wallet.type,
              status: validData.operational_wallet.status,
              address: validData.operational_wallet.address?.substring(0, 8) + '...',
              create_key: validData.operational_wallet.create_key?.substring(0, 8) + '...',
            }
          : null,
      });

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

      await supabaseAdmin.from('organization_members').insert({
        organization_id: data.id,
        user_id: userId,
        role: 'owner',
        status: 'active',
      });

      console.log('User added as organization owner:', {
        userId,
        organizationId: data.id,
      });

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to create organization: ${String(error)}`);
    }
  },

  async update(id: string, organizationData: any): Promise<Organization> {
    try {
      const validData = updateOrganizationSchema.parse({
        id,
        ...organizationData,
      });

      const { data, error } = await supabaseAdmin
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

  async delete(id: string): Promise<void> {
    const { error } = await supabaseAdmin.from('organizations').delete().eq('id', id);

    if (error) throw new Error(`Failed to delete organization: ${error.message}`);
  },

  async addMember(organizationId: string, userId: string, role: string): Promise<void> {
    const isAlreadyInOrg = await this.isUserInAnyOrganization(userId);
    if (isAlreadyInOrg) {
      throw new Error('User is already a member of an organization');
    }

    const { error } = await supabaseAdmin.from('organization_members').insert({
      organization_id: organizationId,
      user_id: userId,
      role,
      status: 'active',
    });

    if (error) throw new Error(`Failed to add member: ${error.message}`);
  },

  async removeMember(organizationId: string, userId: string): Promise<void> {
    const { error } = await supabaseAdmin.from('organization_members').delete().match({
      organization_id: organizationId,
      user_id: userId,
    });

    if (error) throw new Error(`Failed to remove member: ${error.message}`);
  },

  async getMembers(organizationId: string): Promise<any[]> {
    const { data, error } = await supabaseAdmin
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
};
