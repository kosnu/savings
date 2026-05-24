export const monthlyBudgetQueryKeys = {
  listAll: ["monthlyBudgets"],
  list: (limit: number) => ["monthlyBudgets", limit] as const,
  effectiveAll: ["effectiveMonthlyBudget"],
  effective: (targetMonth: string) => ["effectiveMonthlyBudget", targetMonth] as const,
} as const
