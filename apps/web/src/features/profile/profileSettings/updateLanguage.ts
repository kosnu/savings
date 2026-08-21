import { getSupabaseClient } from "../../../lib/supabase"

export interface UpdateLanguageInput {
  authUserId: string
  language: "en" | "ja"
}

export async function updateLanguage({ authUserId, language }: UpdateLanguageInput): Promise<void> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("users")
    .update({ language })
    .eq("auth_user_id", authUserId)
    .select("auth_user_id")
    .single()

  if (error) {
    throw error
  }

  if (!data || Array.isArray(data) || data.auth_user_id !== authUserId) {
    throw new Error("Unable to confirm language update.")
  }
}
