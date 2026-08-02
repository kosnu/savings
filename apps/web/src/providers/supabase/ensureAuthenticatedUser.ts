import type { AppLanguage } from "../../i18n"
import { getSupabaseClient } from "../../lib/supabase"

export async function ensureAuthenticatedUser(
  initialDisplayName: string,
  initialLanguage: AppLanguage | null,
): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc("ensure_authenticated_user", {
    p_initial_display_name: initialDisplayName,
    p_initial_language: initialLanguage,
  })

  if (error) {
    throw error
  }
}
