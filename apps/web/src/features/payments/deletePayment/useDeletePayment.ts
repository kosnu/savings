import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import type { PaymentId } from "../../../types/payment"
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
        queryClient.invalidateQueries({ queryKey: ["payments"] }),
        queryClient.invalidateQueries({ queryKey: ["paymentDetails", paymentId] }),
        queryClient.invalidateQueries({ queryKey: ["totalExpenditures"] }),
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
