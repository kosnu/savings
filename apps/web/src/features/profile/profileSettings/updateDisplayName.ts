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
  const { error } = await supabase.from("users").update({ name }).eq("auth_user_id", authUserId)

  if (error) {
    throw error
  }
}
