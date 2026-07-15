import { getSupabaseClient } from "../../../lib/supabase"
import { profileResponseSchema, type Profile } from "./profileSchema"

const profileColumns = "name, email"

export async function fetchProfile(authUserId: string): Promise<Profile> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("users")
    .select(profileColumns)
    .eq("auth_user_id", authUserId)
    .maybeSingle()

  if (error) {
    throw error
  }

  const result = profileResponseSchema.safeParse(data)
  if (!result.success) {
    throw new Error("Invalid profile response")
  }

  return result.data
}
