import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import type { Payment } from "../../../types/payment"
import type { PaymentUpdatePatch } from "../paymentFormMappers"
import { updatePayment as updatePaymentRecord } from "./updatePayment"

type PaymentId = NonNullable<Payment["id"]>

interface UpdatePaymentInput {
  paymentId: PaymentId
  patch: PaymentUpdatePatch
}

interface UseUpdatePaymentReturn {
  updatePayment: (input: UpdatePaymentInput) => Promise<void>
  isPending: boolean
}

export function useUpdatePayment(
  onSuccess?: () => void,
  onError?: (error?: Error) => void,
): UseUpdatePaymentReturn {
  const queryClient = useQueryClient()

  const { mutateAsync, isPending } = useMutation({
    mutationFn: ({ paymentId, patch }: UpdatePaymentInput) => updatePaymentRecord(paymentId, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] })
      queryClient.invalidateQueries({ queryKey: ["totalExpenditures"] })
      onSuccess?.()
    },
    onError: (error) => {
      onError?.(error)
    },
  })

  const updatePayment = useCallback(
    (input: UpdatePaymentInput) => {
      return mutateAsync(input)
    },
    [mutateAsync],
  )

  return { updatePayment, isPending }
}
