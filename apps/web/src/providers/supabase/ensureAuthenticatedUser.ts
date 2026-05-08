import { getSupabaseClient } from "../../lib/supabase"

export async function ensureAuthenticatedUser(): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc("ensure_authenticated_user")

  if (error) {
    throw error
  }
}
