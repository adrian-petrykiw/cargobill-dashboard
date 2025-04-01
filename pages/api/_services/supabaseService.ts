// pages/api/_services/supabaseService.ts
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create a singleton instance with server-side privileges
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// User operations
export async function getOrCreateUser(privyUserId: string, userInfo: any) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('privy_id', privyUserId)
    .single();

  if (error && error.code !== 'PGRST116') {
    // not found
    throw error;
  }

  if (!data) {
    const { data: newUser, error: createError } = await supabaseAdmin
      .from('users')
      .insert({
        privy_id: privyUserId,
        email: userInfo.email?.address,
        wallet_address: userInfo.wallet?.address,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError) {
      throw createError;
    }

    return newUser;
  }

  return data;
}

// Other Supabase-specific functions go here
