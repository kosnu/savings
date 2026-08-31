import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query"

import { summaryQueryKeys } from "../queryKeys"
import { fetchTotalExpenditures } from "./fetchTotalExpenditures"

interface UseTotalExpendituresReturn {
  data: number | null
}

function totalExpendituresQueryOptions(targetMonth: string) {
  return queryOptions({
    queryKey: summaryQueryKeys.totalExpenditures(targetMonth),
    queryFn: async () => fetchTotalExpenditures(targetMonth),
    staleTime: 3000, // 3秒
  })
}

export function usePrefetchTotalExpenditures(targetMonth: string): void {
  useQuery(totalExpendituresQueryOptions(targetMonth))
}

export function useTotalExpenditures(targetMonth: string): UseTotalExpendituresReturn {
  const query = useSuspenseQuery(totalExpendituresQueryOptions(targetMonth))

  return {
    data: query.data,
  }
}
