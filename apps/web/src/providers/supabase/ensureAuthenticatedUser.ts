import { getSupabaseClient } from "../../lib/supabase"

export async function ensureAuthenticatedUser(initialDisplayName: string): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc("ensure_authenticated_user", {
    p_initial_display_name: initialDisplayName,
  })

  if (error) {
    throw error
  }
}
