// pages/api/_config/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/db/supabase';
import { AuthenticatedRequest } from '@/types/api/requests';

// Admin client (bypasses RLS) - use sparingly
export const supabaseAdmin = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

// Anonymous client (respects RLS)
export const createSupabaseClient = (req?: AuthenticatedRequest) => {
  const client = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // Set user ID from authenticated request
  if (req?.user?.id) {
    // Using the set_claim function we created in the database
    client.rpc('set_claim', {
      claim: 'user_id',
      value: req.user.id,
    });
  }

  return client;
};

export type { Database } from '@/types/db/supabase';
export type Tables = Database['public']['Tables'];
