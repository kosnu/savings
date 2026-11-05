import { queryOptions } from "@tanstack/react-query"

import { paymentQueryKeys } from "../queryKeys"
import { fetchMonthlySpending } from "./fetchMonthlySpending"

export function monthlySpendingQueryOptions(bookId: number, targetMonth: string) {
  return queryOptions({
    queryKey: paymentQueryKeys.monthlySpending(bookId, targetMonth),
    queryFn: async ({ signal }) => fetchMonthlySpending(bookId, targetMonth, signal),
    staleTime: 3000,
  })
}
