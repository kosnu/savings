import { useMutation, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { useCallback } from "react"
import { apiClient, buildFunctionUrl } from "../../../lib/apiClient"
import type { Payment } from "../../../types/payment"

type PaymentValue = Omit<
  Payment,
  "id" | "userId" | "createdDate" | "updatedDate" | "categoryId"
> & {
  categoryId: string
}

interface CreatePaymentRequest {
  amount: number
  date: string
  note: string | null
  categoryId: number | null
}

function toCategoryId(categoryId: string): number | null {
  if (!categoryId) return null
  const parsed = Number(categoryId)
  return Number.isNaN(parsed) ? null : parsed
}

async function postPayment(value: PaymentValue): Promise<void> {
  const url = buildFunctionUrl("payments")
  const body: CreatePaymentRequest = {
    amount: value.amount,
    date: format(value.date, "yyyy-MM-dd"),
    note: value.note || null,
    categoryId: toCategoryId(value.categoryId),
  }
  await apiClient.post(url, { body })
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
