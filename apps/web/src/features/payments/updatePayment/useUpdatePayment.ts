import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import type { PaymentId } from "../../../types/payment"
import { summaryQueryKeys } from "../../summaryByMonth"
import type { PaymentUpdatePatch } from "../paymentFormMappers"
import { paymentQueryKeys } from "../queryKeys"
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
  onSuccess?: () => void,
  onError?: (error: unknown) => void,
): UseUpdatePaymentReturn {
  const queryClient = useQueryClient()

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async ({ paymentId, patch }: UpdatePaymentInput) =>
      updatePaymentRecord(paymentId, patch),
    onSuccess: async (_, { paymentId }) => {
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

  const updatePayment = useCallback(
    async (input: UpdatePaymentInput) => {
      return mutateAsync(input)
    },
    [mutateAsync],
  )

  return { updatePayment, isPending }
}
