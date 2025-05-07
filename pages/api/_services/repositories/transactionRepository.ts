// pages/api/_services/repositories/transactionRepository.ts
import { supabaseAdmin } from '../../_config/supabase';
import {
  createTransactionSchema,
  updateTransactionSchema,
  type Transaction,
} from '@/schemas/transaction.schema';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/db/supabase';

export const transactionRepository = {
  async getByIdSystem(id: string): Promise<Transaction> {
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(`Failed to get transaction: ${error.message}`);
    if (!data) throw new Error(`Transaction not found: ${id}`);

    return data;
  },

  async getById(id: string): Promise<Transaction> {
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(`Failed to get transaction: ${error.message}`);
    if (!data) throw new Error(`Transaction not found: ${id}`);

    return data;
  },

  async getByOrganizationId(organizationId: string): Promise<Transaction[]> {
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .or(
        `sender_organization_id.eq.${organizationId},recipient_organization_id.eq.${organizationId}`,
      )
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get organization transactions: ${error.message}`);

    return data || [];
  },

  async getSentByOrganizationId(organizationId: string): Promise<Transaction[]> {
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('sender_organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get sent transactions: ${error.message}`);

    return data || [];
  },

  async getReceivedByOrganizationId(organizationId: string): Promise<Transaction[]> {
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('recipient_organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get received transactions: ${error.message}`);

    return data || [];
  },

  async create(transactionData: any, userId: string): Promise<Transaction> {
    try {
      // Validate with Zod
      const validData = createTransactionSchema.parse({
        ...transactionData,
        created_by: userId,
      });

      // Use admin client for backend operations
      const { data, error } = await supabaseAdmin
        .from('transactions')
        .insert(validData)
        .select()
        .single();

      if (error) throw new Error(`Failed to create transaction: ${error.message}`);
      if (!data) throw new Error('Failed to retrieve created transaction');

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to create transaction: ${String(error)}`);
    }
  },

  async update(id: string, transactionData: any, userId: string): Promise<Transaction> {
    try {
      // Validate with Zod
      const validData = updateTransactionSchema.parse({
        id,
        ...transactionData,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      });

      // Use admin client for backend operations
      const { data, error } = await supabaseAdmin
        .from('transactions')
        .update(validData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(`Failed to update transaction: ${error.message}`);
      if (!data) throw new Error(`Transaction not found: ${id}`);

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to update transaction: ${String(error)}`);
    }
  },

  async updateStatus(id: string, status: string, userId: string): Promise<Transaction> {
    return this.update(id, { status }, userId);
  },

  async completeTransaction(id: string, userId: string): Promise<Transaction> {
    return this.update(
      id,
      {
        status: 'completed',
        completed_at: new Date().toISOString(),
      },
      userId,
    );
  },

  async createSystem(transactionData: any, userId: string): Promise<Transaction> {
    try {
      const validData = createTransactionSchema.parse({
        ...transactionData,
        created_by: userId,
      });

      const { data, error } = await supabaseAdmin
        .from('transactions')
        .insert(validData)
        .select()
        .single();

      if (error) throw new Error(`Failed to create transaction: ${error.message}`);
      if (!data) throw new Error('Failed to retrieve created transaction');

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to create transaction: ${String(error)}`);
    }
  },

  async updateSystem(id: string, transactionData: any, userId: string): Promise<Transaction> {
    try {
      const validData = updateTransactionSchema.parse({
        id,
        ...transactionData,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      });

      const { data, error } = await supabaseAdmin
        .from('transactions')
        .update(validData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(`Failed to update transaction: ${error.message}`);
      if (!data) throw new Error(`Transaction not found: ${id}`);

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to update transaction: ${String(error)}`);
    }
  },
};
