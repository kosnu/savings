import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { env } from "../config/env"

let supabaseClient: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_PUBLISHABLE_KEY,
    )
  }

  return supabaseClient
}
