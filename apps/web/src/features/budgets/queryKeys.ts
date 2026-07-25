import type { QueryClient } from "@tanstack/react-query"

export const monthlyBudgetQueryKeys = {
  listAll: ["monthlyBudgets"],
  list: (limit: number) => ["monthlyBudgets", limit] as const,
  effectiveAll: ["effectiveMonthlyBudget"],
  effective: (targetMonth: string) => ["effectiveMonthlyBudget", targetMonth] as const,
} as const

export async function invalidateMonthlyBudgetQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: monthlyBudgetQueryKeys.listAll }),
    queryClient.invalidateQueries({ queryKey: monthlyBudgetQueryKeys.effectiveAll }),
  ])
}
