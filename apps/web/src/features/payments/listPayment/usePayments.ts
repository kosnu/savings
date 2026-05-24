import { useQuery } from "@tanstack/react-query"

import type { Payment } from "../../../types/payment"
import { useDateRange } from "../../../utils/useDateRange"
import { paymentQueryKeys } from "../queryKeys"
import { fetchPayments } from "./fetchPayments"

interface UseGetPaymentsReturn {
  data: Payment[]
  loading: boolean
  promise: Promise<Payment[]>
  error: Error | null
}

interface UsePaymentsOptions {
  cacheScope?: string
  categoryId?: number | null
}

export function usePayments({
  cacheScope = "default",
  categoryId,
}: UsePaymentsOptions = {}): UseGetPaymentsReturn {
  const { date, dateRange } = useDateRange()
  const query = useQuery({
    queryKey: paymentQueryKeys.list(cacheScope, date?.toISOString() ?? "all", categoryId),
    queryFn: async () => fetchPayments(dateRange, { categoryId }),
    enabled: date !== null,
    staleTime: 3000, // 3秒
  })

  return {
    data: query.data ?? [],
    loading: query.isLoading,
    promise: query.promise,
    error: query.error,
  }
}
