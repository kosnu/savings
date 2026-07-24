import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import { getSupabaseClient } from "../../../lib/supabase"
import { invalidatePaymentMutationQueries } from "../invalidatePaymentMutationQueries"
import { type PaymentWriteInput, toPaymentWriteInsert } from "../paymentFormMappers"

async function postPayment(value: PaymentWriteInput): Promise<void> {
  const supabase = getSupabaseClient()
  const row = toPaymentWriteInsert(value)
  const { error } = await supabase.from("payments").insert(row)

  if (error) {
    throw error
  }
}

interface UseCreatePaymentReturn {
  createPayment: (value: PaymentWriteInput) => Promise<void>
  isPending: boolean
}

export function useCreatePayment(
  onSuccess?: () => void,
  onError?: (error?: Error) => void,
): UseCreatePaymentReturn {
  const queryClient = useQueryClient()

  const { mutateAsync, isPending } = useMutation({
    mutationFn: postPayment,
    onSuccess: async () => {
      await invalidatePaymentMutationQueries(queryClient)
      onSuccess?.()
    },
    onError: (error) => {
      onError?.(error)
    },
  })

  const createPayment = useCallback(
    async (value: PaymentWriteInput) => {
      await mutateAsync(value)
    },
    [mutateAsync],
  )

  return { createPayment, isPending }
}
