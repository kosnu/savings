import { getSupabaseClient } from "../../../lib/supabase"
import {
  normalizeCategoryBudgetRows,
  pickLatestCategoryBudgetRows,
  toCategoryBudget,
} from "../categoryBudgetMappers"
import type { CategoryBudget } from "../types"

const categoryBudgetColumns = `
  id,
  book_id,
  category_id,
  amount,
  effective_from,
  effective_year,
  effective_month,
  user_id,
  created_at,
  updated_at,
  category:categories!category_budgets_category_id_fkey (
    id,
    name
  )
`

export async function fetchCategoryBudgets(): Promise<CategoryBudget[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("category_budgets")
    .select(categoryBudgetColumns)
    .order("category_id", { ascending: true })
    .order("effective_from", { ascending: false })
    .order("id", { ascending: false })

  if (error) {
    throw error
  }

  return pickLatestCategoryBudgetRows(normalizeCategoryBudgetRows(data ?? [])).map(toCategoryBudget)
}
