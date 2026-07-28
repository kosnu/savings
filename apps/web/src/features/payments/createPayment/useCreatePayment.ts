import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import { getSupabaseClient } from "../../../lib/supabase"
import { invalidatePaymentMutationQueries } from "../invalidatePaymentMutationQueries"
import { type PaymentWriteInput, toPaymentWriteInsert } from "../paymentFormMappers"

async function postPayment(bookId: number, value: PaymentWriteInput): Promise<void> {
  const supabase = getSupabaseClient()
  const row = { ...toPaymentWriteInsert(value), book_id: bookId }
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
  bookId: number,
  onSuccess?: () => void,
  onError?: (error?: Error) => void,
): UseCreatePaymentReturn {
  const queryClient = useQueryClient()

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (value: PaymentWriteInput) => postPayment(bookId, value),
    onSuccess: async () => {
      await invalidatePaymentMutationQueries(queryClient, bookId)
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
