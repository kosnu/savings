import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"

import { useDateRange } from "../../../utils/useDateRange"
import { summaryQueryKeys } from "../queryKeys"
import { type CategoryTotals, fetchCategoryTotals } from "./fetchCategoryTotals"

interface UseCategoryTotalsReturn {
  categoryTotals: CategoryTotals
}

interface UseCategoryTotalsOptions {
  cacheScope?: string
}

function useCategoryTotals({
  cacheScope = "default",
}: UseCategoryTotalsOptions = {}): UseCategoryTotalsReturn {
  const { date, dateRange } = useDateRange()
  const month = date ? format(date, "yyyy-MM") : ""
  const query = useQuery({
    queryKey: summaryQueryKeys.categoryTotals(cacheScope, month),
    queryFn: async () => fetchCategoryTotals(dateRange),
    enabled: !!month,
    staleTime: 3000,
  })

  return { categoryTotals: query.data ?? {} }
}

export { useCategoryTotals }
