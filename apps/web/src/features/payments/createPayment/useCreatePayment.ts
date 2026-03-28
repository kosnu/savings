import { useMutation, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { useCallback } from "react"

import { getSupabaseClient } from "../../../lib/supabase"
import type { TablesInsert } from "../../../types/database.types"
import type { Payment } from "../../../types/payment"

// user_id は DB のデフォルト値（auth.uid()）で自動設定されるため FE から渡さない
type PaymentInsert = Omit<TablesInsert<"payments">, "user_id">

type PaymentValue = Omit<
  Payment,
  "id" | "userId" | "createdDate" | "updatedDate" | "categoryId" | "note"
> & {
  categoryId?: string
  note?: string
}

function toCategoryId(categoryId?: string): number | null {
  if (!categoryId) return null
  const parsed = Number(categoryId)
  return Number.isNaN(parsed) ? null : parsed
}

async function postPayment(value: PaymentValue): Promise<void> {
  const supabase = getSupabaseClient()
  const row: PaymentInsert = {
    amount: value.amount,
    date: format(value.date, "yyyy-MM-dd"),
    note: value.note || null,
    category_id: toCategoryId(value.categoryId),
  }
  const { error } = await supabase
    .from("payments")
    // FIXME: database.types.ts で user_id が必須だが、DB デフォルト値で設定されるため除外している。型定義の再生成で解消したらアサーションを削除する
    .insert(row as TablesInsert<"payments">)

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
      queryClient.invalidateQueries({ queryKey: ["totalExpenditures"] })
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
