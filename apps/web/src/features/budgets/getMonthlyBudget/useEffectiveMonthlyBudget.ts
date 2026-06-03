import { useQuery } from "@tanstack/react-query"

import { formatTargetMonthKey, toTargetMonth } from "../../../domain/date"
import { monthlyBudgetQueryKeys } from "../queryKeys"
import type { MonthlyBudgetState } from "../types"
import { fetchEffectiveMonthlyBudget } from "./fetchEffectiveMonthlyBudget"

interface UseEffectiveMonthlyBudgetReturn {
  data: MonthlyBudgetState
  loading: boolean
  error: Error | null
  promise: Promise<MonthlyBudgetState>
}

const unsetMonthlyBudgetState: MonthlyBudgetState = { status: "unset", monthlyBudget: null }

export function useEffectiveMonthlyBudget(
  targetDate: Date | null,
): UseEffectiveMonthlyBudgetReturn {
  const targetMonth = targetDate ? formatTargetMonthKey(toTargetMonth(targetDate)) : "none"
  const query = useQuery({
    queryKey: monthlyBudgetQueryKeys.effective(targetMonth),
    queryFn: async () => {
      if (!targetDate) {
        return Promise.resolve(unsetMonthlyBudgetState)
      }

      return fetchEffectiveMonthlyBudget(targetDate)
    },
    enabled: targetDate !== null,
    staleTime: 3000, // 3秒
  })

  return {
    data: query.data ?? unsetMonthlyBudgetState,
    loading: query.isLoading,
    error: query.error,
    promise: query.promise,
  }
}
