import { useMutation, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { useCallback } from "react"
import { getSupabaseClient } from "../../../lib/supabase"
import type { Payment } from "../../../types/payment"

type PaymentValue = Omit<
  Payment,
  "id" | "userId" | "createdDate" | "updatedDate" | "categoryId"
> & {
  categoryId: string
}

function toCategoryId(categoryId: string): number | null {
  if (!categoryId) return null
  const parsed = Number(categoryId)
  return Number.isNaN(parsed) ? null : parsed
}

async function postPayment(value: PaymentValue): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("payments").insert({
    amount: value.amount,
    date: format(value.date, "yyyy-MM-dd"),
    note: value.note || null,
    category_id: toCategoryId(value.categoryId),
  })

  if (error) {
    throw error
  }
}

interface UseCreatePaymentReturn {
  createPayment: (value: PaymentValue) => void
  isPending: boolean
}

export function useCreatePayment(
  onSuccess?: () => void,
  onError?: (error?: Error) => void,
): UseCreatePaymentReturn {
  const queryClient = useQueryClient()

  const { mutate, isPending } = useMutation({
    mutationFn: postPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] })
      onSuccess?.()
    },
    onError: (error) => {
      onError?.(error)
    },
  })

  const createPayment = useCallback(
    (value: PaymentValue) => {
      mutate(value)
    },
    [mutate],
  )

  return { createPayment, isPending }
}
