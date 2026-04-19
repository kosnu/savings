import { format } from "date-fns"

import type { TablesInsert } from "../../../types/database.types"

export interface MonthlyBudgetWriteInput {
  targetMonth: Date
  amount: number
}

// user_id は DB のデフォルト値（auth.uid()）で自動設定されるため FE から渡さない
export type MonthlyBudgetInsert = Omit<
  TablesInsert<"monthly_budgets">,
  "user_id" | "effective_year" | "effective_month"
>

export function toMonthlyBudgetInsert(value: MonthlyBudgetWriteInput): MonthlyBudgetInsert {
  return {
    amount: value.amount,
    effective_from: format(toMonthStartDate(value.targetMonth), "yyyy-MM-dd"),
  }
}

function toMonthStartDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}
