import { getSupabaseClient } from "../lib/supabase"
import { i18next, type AppLanguage, toAppLanguage } from "./index"

export async function loadAccountLanguage(authUserId: string): Promise<AppLanguage | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("users")
    .select("language")
    .eq("auth_user_id", authUserId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data?.language === null || data === null ? null : toAppLanguage(data.language)
}

export function resolveAccountLanguage(
  accountLanguage: string | null | undefined,
  deviceLanguage: string | undefined = i18next.resolvedLanguage,
): AppLanguage {
  return accountLanguage === null || accountLanguage === undefined
    ? toAppLanguage(deviceLanguage)
    : toAppLanguage(accountLanguage)
}

export interface UpdateAccountLanguageInput {
  authUserId: string
  language: string
}

export async function updateAccountLanguage({
  authUserId,
  language,
}: UpdateAccountLanguageInput): Promise<void> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("users")
    .update({ language: toAppLanguage(language) })
    .eq("auth_user_id", authUserId)
    .select("auth_user_id")
    .single()

  if (error) {
    throw error
  }

  if (!data || Array.isArray(data) || data.auth_user_id !== authUserId) {
    throw new Error("Unable to confirm account language update.")
  }
}
