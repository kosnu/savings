import { getSupabaseClient } from "../../../lib/supabase"
import { type CategoryUpdateInput, toCategoryUpdateRpcArgs } from "./categoryUpdateMappers"

export async function updateCategory(value: CategoryUpdateInput): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc(
    "update_category_with_budget",
    toCategoryUpdateRpcArgs(value),
  )

  if (error) {
    throw error
  }
}
