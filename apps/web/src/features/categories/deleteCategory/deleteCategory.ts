import { getSupabaseClient } from "../../../lib/supabase"

export async function deleteCategory(categoryId: number): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc("delete_category_with_budget", {
    p_category_id: categoryId,
  })

  if (error) {
    throw error
  }
}
