export interface MonthlyBudgetUpdateInput {
  amount: number
}

export interface MonthlyBudgetUpdateArgs {
  p_amount: number
}

export function toMonthlyBudgetUpdateArgs(
  value: MonthlyBudgetUpdateInput,
): MonthlyBudgetUpdateArgs {
  return {
    p_amount: value.amount,
  }
}
