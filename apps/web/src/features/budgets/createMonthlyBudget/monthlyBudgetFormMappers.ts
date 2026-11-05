import { toDateOnlyString, toMonthStartDate } from "../../../domain/date"
import { targetMonthFieldSchema } from "./monthlyBudgetFormSchema"

export interface MonthlyBudgetWriteInput {
  targetMonth: Date
  amount: number
}

export interface MonthlyBudgetCreateArgs {
  p_amount: number
  p_effective_month: string
}

export function toMonthlyBudgetCreateArgs(value: MonthlyBudgetWriteInput): MonthlyBudgetCreateArgs {
  return {
    p_amount: value.amount,
    p_effective_month: toDateOnlyString(
      toMonthStartDate(targetMonthFieldSchema.parse(value.targetMonth)),
    ),
  }
}
