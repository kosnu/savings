import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query"

import { parseDateOnlyStringToLocalDate } from "../../../domain/date"
import { monthlyBudgetQueryKeys } from "../queryKeys"
import type { MonthlyBudgetState } from "../types"
import { fetchEffectiveMonthlyBudget } from "./fetchEffectiveMonthlyBudget"

interface UseEffectiveMonthlyBudgetReturn {
  data: MonthlyBudgetState
}

function effectiveMonthlyBudgetQueryOptions(targetMonth: string) {
  return queryOptions({
    queryKey: monthlyBudgetQueryKeys.effective(targetMonth),
    queryFn: async () =>
      fetchEffectiveMonthlyBudget(parseDateOnlyStringToLocalDate(`${targetMonth}-01`)),
    staleTime: 3000, // 3秒
  })
}

export function usePrefetchEffectiveMonthlyBudget(targetMonth: string): void {
  useQuery(effectiveMonthlyBudgetQueryOptions(targetMonth))
}

export function useEffectiveMonthlyBudget(targetMonth: string): UseEffectiveMonthlyBudgetReturn {
  const query = useSuspenseQuery(effectiveMonthlyBudgetQueryOptions(targetMonth))

  return {
    data: query.data,
  }
}
