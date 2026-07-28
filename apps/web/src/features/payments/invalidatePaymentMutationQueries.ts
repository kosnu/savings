import type { QueryClient } from "@tanstack/react-query"

import { summaryQueryKeys } from "../summaryByMonth"
import { paymentQueryKeys } from "./queryKeys"

export async function invalidatePaymentMutationQueries(
  queryClient: QueryClient,
  bookId: number,
): Promise<void> {
  const queryKeys = [
    paymentQueryKeys.book(bookId),
    paymentQueryKeys.detailsBook(bookId),
    summaryQueryKeys.totalExpendituresAll,
    summaryQueryKeys.categoryTotalsAll,
  ]

  await Promise.all(
    queryKeys.map(async (queryKey) => {
      await queryClient.invalidateQueries({ queryKey })
    }),
  )
}
