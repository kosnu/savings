import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import { createMonthlyBudget as createMonthlyBudgetRecord } from "./createMonthlyBudget"
import type { MonthlyBudgetWriteInput } from "./monthlyBudgetFormMappers"

interface UseCreateMonthlyBudgetReturn {
  createMonthlyBudget: (value: MonthlyBudgetWriteInput) => Promise<void>
  isPending: boolean
}

export function useCreateMonthlyBudget(
  onSuccess?: () => void,
  onError?: (error: unknown) => void,
): UseCreateMonthlyBudgetReturn {
  const queryClient = useQueryClient()

  const { mutateAsync, isPending } = useMutation({
    mutationFn: createMonthlyBudgetRecord,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["monthlyBudgets"] })
      onSuccess?.()
    },
    onError: (error) => {
      onError?.(error)
    },
  })

  const createMonthlyBudget = useCallback(
    (value: MonthlyBudgetWriteInput) => {
      return mutateAsync(value)
    },
    [mutateAsync],
  )

  return { createMonthlyBudget, isPending }
}
