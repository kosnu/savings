import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import type { PaymentId } from "../../../types/payment"
import { summaryQueryKeys } from "../../summaryByMonth"
import { paymentQueryKeys } from "../queryKeys"
import { removePayment } from "./removePayment"

interface UseDeletePaymentReturn {
  deletePayment: (paymentId: PaymentId) => Promise<void>
  isPending: boolean
}

export function useDeletePayment(
  onSuccess?: () => void,
  onError?: (error?: Error) => void,
): UseDeletePaymentReturn {
  const queryClient = useQueryClient()

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (paymentId: PaymentId) => removePayment(paymentId),
    onSuccess: async (__, paymentId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: paymentQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: paymentQueryKeys.details(paymentId) }),
        queryClient.invalidateQueries({ queryKey: summaryQueryKeys.totalExpendituresAll }),
        queryClient.invalidateQueries({ queryKey: summaryQueryKeys.categoryTotalsAll }),
      ])
      onSuccess?.()
    },
    onError: (error) => {
      onError?.(error)
    },
  })

  const deletePayment = useCallback(
    async (paymentId: PaymentId) => {
      return mutateAsync(paymentId)
    },
    [mutateAsync],
  )

  return { deletePayment, isPending }
}
