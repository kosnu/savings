import { useQuery } from "@tanstack/react-query"

import type { PaymentDetails, PaymentId } from "../../../types/payment"
import { paymentQueryKeys } from "../queryKeys"
import { fetchPaymentDetails } from "./fetchPaymentDetails"

interface UsePaymentDetailsReturn {
  data: PaymentDetails | null | undefined
  isLoading: boolean
  error: Error | null
}

export function usePaymentDetails(
  bookId: number,
  paymentId: PaymentId | null,
): UsePaymentDetailsReturn {
  const query = useQuery({
    queryKey: paymentQueryKeys.details(bookId, paymentId),
    queryFn: async () => {
      if (paymentId === null) {
        return Promise.resolve(null)
      }
      return fetchPaymentDetails(bookId, paymentId)
    },
    enabled: paymentId !== null,
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
  }
}
