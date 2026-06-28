import { toDateOnlyString, toMonthStartDate } from "../../../domain/date"

export interface MonthlyBudgetUpdateInput {
  targetMonth: Date
  currentMonth: Date
  amount: number
}

export interface MonthlyBudgetUpdateArgs {
  p_target_month: string
  p_current_month: string
  p_amount: number
}

export function toMonthlyBudgetUpdateArgs(
  value: MonthlyBudgetUpdateInput,
): MonthlyBudgetUpdateArgs {
  return {
    p_target_month: toDateOnlyString(toMonthStartDate(value.targetMonth)),
    p_current_month: toDateOnlyString(toMonthStartDate(value.currentMonth)),
    p_amount: value.amount,
  }
}
