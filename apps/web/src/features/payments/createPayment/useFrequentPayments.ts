import { useQuery } from "@tanstack/react-query"

import { paymentQueryKeys } from "../queryKeys"
import { fetchFrequentPayments } from "./fetchFrequentPayments"
import { getFrequentPaymentDateRange, type FrequentPayment } from "./frequentPayment"

interface UseFrequentPaymentsReturn {
  payments: FrequentPayment[] | undefined
  isPending: boolean
  isError: boolean
}

export function useFrequentPayments(
  bookId: number,
  referenceDate: Date,
): UseFrequentPaymentsReturn {
  const dateRange = getFrequentPaymentDateRange(referenceDate)
  const query = useQuery({
    queryKey: paymentQueryKeys.frequent(bookId, dateRange.startDate, dateRange.endDate),
    queryFn: async () => fetchFrequentPayments({ bookId, ...dateRange }),
    staleTime: 3000,
  })

  return {
    payments: query.data,
    isPending: query.isPending,
    isError: query.isError,
  }
}
