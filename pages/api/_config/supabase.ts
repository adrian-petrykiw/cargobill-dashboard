// pages/api/_config/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/db/supabase';

// Server-side client with service_role key (NEVER exposed to frontend)
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

export type { Database } from '@/types/db/supabase';
export type Tables = Database['public']['Tables'];
