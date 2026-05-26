import type { Database } from "../../../types/database.types"

type CategoryUpdateRpcArgs = Database["public"]["Functions"]["update_category_with_budget"]["Args"]

export interface CategoryUpdateInput {
  categoryId: number
  name: string
  categoryBudgetId: number
  budgetAmount: number
}

export function toCategoryUpdateRpcArgs(value: CategoryUpdateInput): CategoryUpdateRpcArgs {
  return {
    p_category_id: value.categoryId,
    p_category_name: value.name,
    p_category_budget_id: value.categoryBudgetId,
    p_budget_amount: value.budgetAmount,
  }
}
