import type { TablesUpdate } from "../../../types/database.types"

export interface MonthlyBudgetUpdateInput {
  monthlyBudgetId: number
  amount: number
}

export type MonthlyBudgetUpdate = Pick<TablesUpdate<"monthly_budgets">, "amount">

export function toMonthlyBudgetUpdate(value: MonthlyBudgetUpdateInput): MonthlyBudgetUpdate {
  return {
    amount: value.amount,
  }
}
