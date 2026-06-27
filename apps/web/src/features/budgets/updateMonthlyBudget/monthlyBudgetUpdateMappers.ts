import { toDateOnlyString, toMonthStartDate } from "../../../domain/date"

export interface MonthlyBudgetUpdateInput {
  targetMonth: Date
  amount: number
}

export interface MonthlyBudgetUpdateArgs {
  p_target_month: string
  p_amount: number
}

export function toMonthlyBudgetUpdateArgs(
  value: MonthlyBudgetUpdateInput,
): MonthlyBudgetUpdateArgs {
  return {
    p_target_month: toDateOnlyString(toMonthStartDate(value.targetMonth)),
    p_amount: value.amount,
  }
}
