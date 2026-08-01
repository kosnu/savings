import type { AppLanguage } from "../../../i18n"
import { getSupabaseClient } from "../../../lib/supabase"
import { languagePreferenceResponseSchema } from "./languagePreferenceSchema"

export async function fetchLanguagePreference(authUserId: string): Promise<AppLanguage | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("users")
    .select("language")
    .eq("auth_user_id", authUserId)
    .maybeSingle()

  if (error) {
    throw error
  }

  const result = languagePreferenceResponseSchema.safeParse(data)
  if (!result.success) {
    throw new Error("Invalid language preference response")
  }

  return result.data.language
}
