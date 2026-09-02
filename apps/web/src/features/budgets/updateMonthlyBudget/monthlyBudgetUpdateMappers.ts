export interface MonthlyBudgetUpdateInput {
  monthlyBudgetId: number
  amount: number
}

export interface MonthlyBudgetUpdateArgs {
  p_monthly_budget_id: number
  p_amount: number
}

export function toMonthlyBudgetUpdateArgs(
  value: MonthlyBudgetUpdateInput,
): MonthlyBudgetUpdateArgs {
  return {
    p_monthly_budget_id: value.monthlyBudgetId,
    p_amount: value.amount,
  }
}
