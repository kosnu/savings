import type { AppLanguage } from "../../../i18n"
import { getSupabaseClient } from "../../../lib/supabase"
import { languagePreferenceUpdateResponseSchema } from "./languagePreferenceSchema"

interface UpdateLanguagePreferenceInput {
  authUserId: string
  language: AppLanguage
}

export async function updateLanguagePreference({
  authUserId,
  language,
}: UpdateLanguagePreferenceInput): Promise<void> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("users")
    .update({ language })
    .eq("auth_user_id", authUserId)
    .select("auth_user_id, language")
    .single()

  if (error) {
    throw error
  }

  const result = languagePreferenceUpdateResponseSchema.safeParse(data)
  if (
    !result.success ||
    result.data.auth_user_id !== authUserId ||
    result.data.language !== language
  ) {
    throw new Error("Unable to confirm language preference update.")
  }
}
