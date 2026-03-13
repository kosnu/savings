import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../types/database.types"

let supabaseTestClient: SupabaseClient<Database> | null = null

export function getSupabaseTestClient(): SupabaseClient<Database> {
  if (!supabaseTestClient) {
    supabaseTestClient = createClient<Database>(
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
  }

  return supabaseTestClient
}
