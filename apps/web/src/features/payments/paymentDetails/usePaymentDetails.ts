import { useQuery } from "@tanstack/react-query"

import type { PaymentDetails, PaymentId } from "../../../types/payment"
import { fetchPaymentDetails } from "./fetchPaymentDetails"

interface UsePaymentDetailsReturn {
  data: PaymentDetails | null | undefined
  isLoading: boolean
  error: Error | null
}

export function usePaymentDetails(paymentId: PaymentId | null): UsePaymentDetailsReturn {
  const query = useQuery({
    queryKey: ["paymentDetails", paymentId],
    queryFn: () => {
      if (paymentId === null) {
        return Promise.resolve(null)
      }
      return fetchPaymentDetails(paymentId)
    },
    enabled: paymentId !== null,
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
  }
}
