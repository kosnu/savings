import { getSupabaseClient } from "../../../lib/supabase"
import { profileResponseSchema, type Profile } from "./profileSchema"

const profileColumns = "name, email, language"

export async function fetchProfile(authUserId: string, signal?: AbortSignal): Promise<Profile> {
  const supabase = getSupabaseClient()
  let query = supabase.from("users").select(profileColumns).eq("auth_user_id", authUserId)

  if (signal !== undefined) {
    query = query.abortSignal(signal)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    throw error
  }

  const result = profileResponseSchema.safeParse(data)
  if (!result.success) {
    throw new Error("Invalid profile response")
  }

  return result.data
}
