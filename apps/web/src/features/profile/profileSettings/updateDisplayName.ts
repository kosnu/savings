import { getSupabaseClient } from "../../../lib/supabase"

export interface UpdateDisplayNameInput {
  authUserId: string
  name: string
}

export async function updateDisplayName({
  authUserId,
  name,
}: UpdateDisplayNameInput): Promise<void> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("users")
    .update({ name })
    .eq("auth_user_id", authUserId)
    .select("auth_user_id")
    .single()

  if (error) {
    throw error
  }

  if (!data || Array.isArray(data) || data.auth_user_id !== authUserId) {
    throw new Error("Unable to confirm display name update.")
  }
}
