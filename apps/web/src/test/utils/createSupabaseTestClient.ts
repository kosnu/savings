import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "../../types/database.types"

export const supabaseTestClient: SupabaseClient<Database> = createClient<Database>(
  "http://localhost:54321",
  "test-anon-key",
  {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
      storageKey: "supabase-test-auth-token",
    },
  },
)
