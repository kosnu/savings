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
  bookId: number,
  onSuccess?: () => void,
  onError?: (error?: Error) => void,
): UseDeletePaymentReturn {
  const queryClient = useQueryClient()

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (paymentId: PaymentId) => removePayment(bookId, paymentId),
    onSuccess: async () => {
      await invalidatePaymentMutationQueries(queryClient, bookId)
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
