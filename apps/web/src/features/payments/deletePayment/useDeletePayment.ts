import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import type { Payment } from "../../../types/payment"
import { removePayment } from "./removePayment"

type PaymentId = NonNullable<Payment["id"]>

interface UseDeletePaymentReturn {
  deletePayment: (paymentId: PaymentId) => void
  isPending: boolean
}

export function useDeletePayment(
  onSuccess?: () => void,
  onError?: (error?: Error) => void,
): UseDeletePaymentReturn {
  const queryClient = useQueryClient()

  const { mutate, isPending } = useMutation({
    mutationFn: (paymentId: PaymentId) => removePayment(paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] })
      onSuccess?.()
    },
    onError: (error) => {
      onError?.(error)
    },
  })

  const deletePayment = useCallback(
    (paymentId: PaymentId) => {
      mutate(paymentId)
    },
    [mutate],
  )

  return { deletePayment, isPending }
}
