import { format } from "date-fns"

import type { TablesInsert } from "../../../types/database.types"
import { toMonthStartDate } from "../utils/month"

export interface MonthlyBudgetWriteInput {
  targetMonth: Date
  amount: number
}

// book_id と user_id は DB のデフォルト値で自動設定されるため FE から渡さない
export type MonthlyBudgetInsert = Omit<
  TablesInsert<"monthly_budgets">,
  "book_id" | "user_id" | "effective_year" | "effective_month"
>

export function toMonthlyBudgetInsert(value: MonthlyBudgetWriteInput): MonthlyBudgetInsert {
  return {
    amount: value.amount,
    effective_from: format(toMonthStartDate(value.targetMonth), "yyyy-MM-dd"),
  }
}
