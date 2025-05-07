// pages/api/_config/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/db/supabase';
import { AuthenticatedRequest } from '@/types/api/requests';

// Admin client for backend API operations
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

// Anonymous client for frontend operations (respects RLS)
export const createSupabaseClient = (req?: AuthenticatedRequest) => {
  // Initialize headers if authorization exists
  let headers: Record<string, string> | undefined = undefined;

  if (req?.headers?.authorization) {
    headers = {
      Authorization: req.headers.authorization,
    };
  }

  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers,
    },
  });
};

export type { Database } from '@/types/db/supabase';
export type Tables = Database['public']['Tables'];
