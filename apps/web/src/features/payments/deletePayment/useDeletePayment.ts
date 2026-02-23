import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import type { Payment } from "../../../types/payment"
import { removePayment } from "./removePayment"

interface UseDeletePaymentReturn {
  deletePayment: (payment: Payment) => void
  isPending: boolean
}

export function useDeletePayment(
  onSuccess?: () => void,
  onError?: (error?: Error) => void,
): UseDeletePaymentReturn {
  const queryClient = useQueryClient()

  const { mutate, isPending } = useMutation({
    mutationFn: (payment: Payment) => removePayment(payment.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] })
      onSuccess?.()
    },
    onError: (error) => {
      onError?.(error)
    },
  })

  const deletePayment = useCallback(
    (payment: Payment) => {
      mutate(payment)
    },
    [mutate],
  )

  return { deletePayment, isPending }
}
