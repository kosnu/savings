import { useSuspenseQuery } from "@tanstack/react-query"

import type { Payment } from "../../../types/payment"
import { useDateRange } from "../../../utils/useDateRange"
import { paymentQueryKeys } from "../queryKeys"
import { fetchPayments } from "./fetchPayments"

interface UseGetPaymentsReturn {
  data: Payment[]
}

interface UsePaymentsOptions {
  cacheScope?: string
  categoryId?: number | null
}

export function usePayments(
  bookId: number,
  { cacheScope = "default", categoryId }: UsePaymentsOptions = {},
): UseGetPaymentsReturn {
  const { date, dateRange } = useDateRange()
  const query = useSuspenseQuery({
    queryKey: paymentQueryKeys.list(bookId, cacheScope, date?.toISOString() ?? "all", categoryId),
    queryFn: async () => fetchPayments(bookId, dateRange, { categoryId }),
    staleTime: 3000, // 3秒
  })

  return {
    data: query.data,
  }
}
