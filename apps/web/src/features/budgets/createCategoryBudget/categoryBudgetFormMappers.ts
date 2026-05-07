import { format } from "date-fns"

import type { TablesInsert } from "../../../types/database.types"
import { toMonthStartDate } from "../utils/month"

export interface CategoryBudgetWriteInput {
  categoryId: number
  targetMonth: Date
  amount: number
}

// book_id と user_id は DB のデフォルト値で自動設定されるため FE から渡さない
export type CategoryBudgetInsert = Omit<
  TablesInsert<"category_budgets">,
  "book_id" | "user_id" | "effective_year" | "effective_month"
>

export function toCategoryBudgetInsert(value: CategoryBudgetWriteInput): CategoryBudgetInsert {
  return {
    amount: value.amount,
    category_id: value.categoryId,
    effective_from: format(toMonthStartDate(value.targetMonth), "yyyy-MM-dd"),
  }
}
