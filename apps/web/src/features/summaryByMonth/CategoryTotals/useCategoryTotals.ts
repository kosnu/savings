import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"

import { useDateRange } from "../../../utils/useDateRange"
import { fetchCategoryTotals } from "./fetchCategoryTotals"

interface UseCategoryTotalsReturn {
  categoryTotals: Record<string, number>
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
    queryKey: ["categoryTotals", cacheScope, month],
    queryFn: async () => fetchCategoryTotals(dateRange),
    enabled: !!month,
    staleTime: 3000,
  })

  return { categoryTotals: query.data ?? {} }
}

export { useCategoryTotals }
