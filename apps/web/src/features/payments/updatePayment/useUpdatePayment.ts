import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import type { PaymentId } from "../../../types/payment"
import { invalidatePaymentMutationQueries } from "../invalidatePaymentMutationQueries"
import type { PaymentUpdatePatch } from "../paymentFormMappers"
import { updatePayment as updatePaymentRecord } from "./updatePayment"

interface UpdatePaymentInput {
  paymentId: PaymentId
  patch: PaymentUpdatePatch
}

interface UseUpdatePaymentReturn {
  updatePayment: (input: UpdatePaymentInput) => Promise<void>
  isPending: boolean
}

export function useUpdatePayment(
  bookId: number,
  onSuccess?: () => void,
  onError?: (error: unknown) => void,
): UseUpdatePaymentReturn {
  const queryClient = useQueryClient()

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async ({ paymentId, patch }: UpdatePaymentInput) =>
      updatePaymentRecord(bookId, paymentId, patch),
    onSuccess: async () => {
      await invalidatePaymentMutationQueries(queryClient, bookId)
      onSuccess?.()
    },
    onError: (error) => {
      onError?.(error)
    },
  })

  const updatePayment = useCallback(
    async (input: UpdatePaymentInput) => {
      return mutateAsync(input)
    },
    [mutateAsync],
  )

  return { updatePayment, isPending }
}
