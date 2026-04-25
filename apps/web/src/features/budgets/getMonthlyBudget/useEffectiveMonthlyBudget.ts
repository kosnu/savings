import { useQuery } from "@tanstack/react-query"

import type { MonthlyBudget } from "../types"
import { formatTargetMonthKey, toTargetMonth } from "../utils/month"
import { fetchEffectiveMonthlyBudget } from "./fetchEffectiveMonthlyBudget"

interface UseEffectiveMonthlyBudgetReturn {
  data: MonthlyBudget | null
  loading: boolean
  error: Error | null
  promise: Promise<MonthlyBudget | null>
}

export function useEffectiveMonthlyBudget(
  targetDate: Date | null,
): UseEffectiveMonthlyBudgetReturn {
  const targetMonth = targetDate ? formatTargetMonthKey(toTargetMonth(targetDate)) : "none"
  const query = useQuery({
    queryKey: ["effectiveMonthlyBudget", targetMonth],
    queryFn: async () => {
      if (!targetDate) {
        return Promise.resolve(null)
      }

      return fetchEffectiveMonthlyBudget(targetDate)
    },
    enabled: targetDate !== null,
    staleTime: 3000, // 3秒
  })

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error,
    promise: query.promise,
  }
}
