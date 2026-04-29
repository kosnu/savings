import { getSupabaseClient } from "../../../lib/supabase"
import { type CategoryBudgetWriteInput, toCategoryBudgetInsert } from "./categoryBudgetFormMappers"

export async function createCategoryBudget(value: CategoryBudgetWriteInput): Promise<void> {
  const supabase = getSupabaseClient()
  const row = toCategoryBudgetInsert(value)
  const { error } = await supabase.from("category_budgets").insert(row)

  if (error) {
    throw error
  }
}
