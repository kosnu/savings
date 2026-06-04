import { useQuery } from "@tanstack/react-query"

import { formatTargetMonthKey, toTargetMonth } from "../../../domain/date"
import { useDateRange } from "../../../utils/useDateRange"
import { summaryQueryKeys } from "../queryKeys"
import { type CategoryTotals, fetchCategoryTotals } from "./fetchCategoryTotals"

interface UseCategoryTotalsReturn {
  categoryTotals: CategoryTotals
  loading: boolean
  targetMonthKey: string
}

interface UseCategoryTotalsOptions {
  cacheScope?: string
}

function useCategoryTotals({
  cacheScope = "default",
}: UseCategoryTotalsOptions = {}): UseCategoryTotalsReturn {
  const { date, dateRange } = useDateRange()
  const month = date ? formatTargetMonthKey(toTargetMonth(date)) : ""
  const query = useQuery({
    queryKey: summaryQueryKeys.categoryTotals(cacheScope, month),
    queryFn: async () => fetchCategoryTotals(dateRange),
    enabled: !!month,
    staleTime: 3000,
  })

  return { categoryTotals: query.data ?? [], loading: query.isLoading, targetMonthKey: month }
}

export { useCategoryTotals }
