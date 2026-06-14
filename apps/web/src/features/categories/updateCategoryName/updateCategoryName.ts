import { toDateOnlyString, toMonthStartDate } from "../../../domain/date"
import { getSupabaseClient } from "../../../lib/supabase"
import type { CategoryNameUpdateInput } from "./categoryNameUpdateMappers"

export async function updateCategoryName(value: CategoryNameUpdateInput): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.rpc("update_category_with_pin_and_budget", {
    p_budget_action: value.budgetAction,
    p_budget_amount: value.budgetAmount,
    p_category_id: value.categoryId,
    p_category_name: value.name,
    p_effective_month: toDateOnlyString(toMonthStartDate(new Date())),
    p_pinned: value.pinned,
  })

  if (error) {
    throw error
  }
}
