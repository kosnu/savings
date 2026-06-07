import { getSupabaseClient } from "../../../lib/supabase"
import type { CategoryNameUpdateInput } from "./categoryNameUpdateMappers"

export async function updateCategoryName(value: CategoryNameUpdateInput): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc("update_category_with_settings", {
    p_budget_amount: value.budgetAmount,
    p_budget_status: value.budgetStatus,
    p_category_id: value.categoryId,
    p_category_name: value.name,
    p_pinned: value.pinned,
  })

  if (error) {
    throw error
  }
}
