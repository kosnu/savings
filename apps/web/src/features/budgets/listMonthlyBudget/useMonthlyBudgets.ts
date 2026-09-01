import { useSuspenseQuery } from "@tanstack/react-query"

import { monthlyBudgetQueryKeys } from "../queryKeys"
import type { MonthlyBudget } from "../types"
import { fetchMonthlyBudgets } from "./fetchMonthlyBudgets"

interface UseMonthlyBudgetsReturn {
  data: MonthlyBudget[]
}

export function useMonthlyBudgets(limit: number): UseMonthlyBudgetsReturn {
  const query = useSuspenseQuery({
    queryKey: monthlyBudgetQueryKeys.list(limit),
    queryFn: async () => fetchMonthlyBudgets(limit),
    staleTime: 3000, // 3秒
  })

  return {
    data: query.data,
  }
}
