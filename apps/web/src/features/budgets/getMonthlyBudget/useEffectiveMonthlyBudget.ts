import { useSuspenseQuery } from "@tanstack/react-query"

import { formatTargetMonthKey, toTargetMonth } from "../../../domain/date"
import { monthlyBudgetQueryKeys } from "../queryKeys"
import type { MonthlyBudgetState } from "../types"
import { fetchEffectiveMonthlyBudget } from "./fetchEffectiveMonthlyBudget"

interface UseEffectiveMonthlyBudgetReturn {
  data: MonthlyBudgetState
}

export function useEffectiveMonthlyBudget(targetDate: Date): UseEffectiveMonthlyBudgetReturn {
  const targetMonth = formatTargetMonthKey(toTargetMonth(targetDate))
  const query = useSuspenseQuery({
    queryKey: monthlyBudgetQueryKeys.effective(targetMonth),
    queryFn: async () => fetchEffectiveMonthlyBudget(targetDate),
    staleTime: 3000, // 3秒
  })

  return {
    data: query.data,
  }
}
