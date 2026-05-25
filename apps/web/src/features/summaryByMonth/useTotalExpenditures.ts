import { useQuery } from "@tanstack/react-query"

import { formatTargetMonthKey, toTargetMonth } from "../../domain/date"
import { useDateRange } from "../../utils/useDateRange"
import { fetchTotalExpenditures } from "./fetchTotalExpenditures"
import { summaryQueryKeys } from "./queryKeys"

interface UseTotalExpendituresReturn {
  data: number | null
  loading: boolean
  error: Error | null
  promise: Promise<number | null>
}

export function useTotalExpenditures(): UseTotalExpendituresReturn {
  const { date } = useDateRange()
  const month = date ? formatTargetMonthKey(toTargetMonth(date)) : ""

  const query = useQuery({
    queryKey: summaryQueryKeys.totalExpenditures(month),
    queryFn: async () => fetchTotalExpenditures(month),
    enabled: !!month,
    staleTime: 3000, // 3秒
  })

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error,
    promise: query.promise,
  }
}
