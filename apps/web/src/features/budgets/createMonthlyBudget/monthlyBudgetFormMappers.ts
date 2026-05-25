import { toDateOnlyString, toMonthStartDate } from "../../../domain/date"
import type { TablesInsert } from "../../../types/database.types"

export interface MonthlyBudgetWriteInput {
  targetMonth: Date
  amount: number
}

// book_id は DB のデフォルト値で自動設定されるため FE から渡さない
export type MonthlyBudgetInsert = Omit<
  TablesInsert<"monthly_budgets">,
  "book_id" | "effective_year" | "effective_month"
>

export function toMonthlyBudgetInsert(value: MonthlyBudgetWriteInput): MonthlyBudgetInsert {
  return {
    amount: value.amount,
    effective_from: toDateOnlyString(toMonthStartDate(value.targetMonth)),
  }
}
