import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { env } from "../config/env"
import type { Database } from "../types/database.types"

let supabaseClient: SupabaseClient<Database> | null = null

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!supabaseClient) {
    supabaseClient = createClient<Database>(
      env.SUPABASE_URL,
      env.SUPABASE_PUBLISHABLE_KEY,
    )
  }

  return supabaseClient
}
