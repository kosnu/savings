import { useQuery } from "@tanstack/react-query"

import type { MonthlyBudget } from "../types"
import { fetchMonthlyBudgets } from "./fetchMonthlyBudgets"

interface UseMonthlyBudgetsReturn {
  data: MonthlyBudget[]
  loading: boolean
  error: Error | null
  promise: Promise<MonthlyBudget[]>
}

export function useMonthlyBudgets(limit: number): UseMonthlyBudgetsReturn {
  const query = useQuery({
    queryKey: ["monthlyBudgets", limit],
    queryFn: async () => fetchMonthlyBudgets(limit),
    staleTime: 3000, // 3秒
  })

  return {
    data: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    promise: query.promise,
  }
}
