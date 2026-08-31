import { useSuspenseQuery } from "@tanstack/react-query"

import { formatTargetMonthKey, toTargetMonth } from "../../../domain/date"
import { useDateRange } from "../../../utils/useDateRange"
import { summaryQueryKeys } from "../queryKeys"
import { fetchTotalExpenditures } from "./fetchTotalExpenditures"

interface UseTotalExpendituresReturn {
  data: number | null
}

export function useTotalExpenditures(): UseTotalExpendituresReturn {
  const { date } = useDateRange()
  const month = date ? formatTargetMonthKey(toTargetMonth(date)) : ""

  const query = useSuspenseQuery({
    queryKey: summaryQueryKeys.totalExpenditures(month),
    queryFn: async () => fetchTotalExpenditures(month),
    staleTime: 3000, // 3秒
  })

  return {
    data: query.data,
  }
}
