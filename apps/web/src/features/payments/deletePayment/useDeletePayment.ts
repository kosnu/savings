import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import type { PaymentId } from "../../../types/payment"
import { invalidatePaymentMutationQueries } from "../invalidatePaymentMutationQueries"
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
      await invalidatePaymentMutationQueries(queryClient, paymentId)
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
