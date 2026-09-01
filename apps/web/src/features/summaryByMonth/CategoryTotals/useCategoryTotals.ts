import { useSuspenseQuery } from "@tanstack/react-query"

import { formatTargetMonthKey, toTargetMonth } from "../../../domain/date"
import { useDateRange } from "../../../utils/useDateRange"
import { summaryQueryKeys } from "../queryKeys"
import { type CategoryTotals, fetchCategoryTotals } from "./fetchCategoryTotals"

interface UseCategoryTotalsReturn {
  data: CategoryTotals
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
  const query = useSuspenseQuery({
    queryKey: summaryQueryKeys.categoryTotals(cacheScope, month),
    queryFn: async () => fetchCategoryTotals(dateRange),
    staleTime: 3000,
  })

  return { data: query.data, targetMonthKey: month }
}

export { useCategoryTotals }
