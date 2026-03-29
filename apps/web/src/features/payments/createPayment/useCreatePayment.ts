import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import { getSupabaseClient } from "../../../lib/supabase"
import type { TablesInsert } from "../../../types/database.types"
import { type PaymentWriteInput, toPaymentWriteInsert } from "../paymentFormMappers"

// user_id は DB のデフォルト値（auth.uid()）で自動設定されるため FE から渡さない
type PaymentInsert = Omit<TablesInsert<"payments">, "user_id">

async function postPayment(value: PaymentWriteInput): Promise<void> {
  const supabase = getSupabaseClient()
  const row: PaymentInsert = toPaymentWriteInsert(value)
  const { error } = await supabase
    .from("payments")
    // FIXME: database.types.ts で user_id が必須だが、DB デフォルト値で設定されるため除外している。型定義の再生成で解消したらアサーションを削除する
    .insert(row as TablesInsert<"payments">)

  if (error) {
    throw error
  }
}

interface UseCreatePaymentReturn {
  createPayment: (value: PaymentWriteInput) => void
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
    (value: PaymentWriteInput) => {
      mutate(value)
    },
    [mutate],
  )

  return { createPayment, isPending }
}
