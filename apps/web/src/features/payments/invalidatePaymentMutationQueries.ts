import type { QueryClient } from "@tanstack/react-query"

import type { PaymentId } from "../../types/payment"
import { summaryQueryKeys } from "../summaryByMonth"
import { paymentQueryKeys } from "./queryKeys"

export async function invalidatePaymentMutationQueries(
  queryClient: QueryClient,
  paymentId?: PaymentId,
): Promise<void> {
  const detailQueryKeys = paymentId === undefined ? [] : [paymentQueryKeys.details(paymentId)]
  const queryKeys = [
    paymentQueryKeys.all,
    ...detailQueryKeys,
    summaryQueryKeys.totalExpendituresAll,
    summaryQueryKeys.categoryTotalsAll,
  ]

  await Promise.all(
    queryKeys.map(async (queryKey) => {
      await queryClient.invalidateQueries({ queryKey })
    }),
  )
}
