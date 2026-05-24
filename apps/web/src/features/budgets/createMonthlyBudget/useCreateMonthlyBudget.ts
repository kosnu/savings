import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import { monthlyBudgetQueryKeys } from "../queryKeys"
import { createMonthlyBudget as createMonthlyBudgetRecord } from "./createMonthlyBudget"
import type { MonthlyBudgetWriteInput } from "./monthlyBudgetFormMappers"

interface UseCreateMonthlyBudgetReturn {
  createMonthlyBudget: (value: MonthlyBudgetWriteInput) => Promise<void>
  isPending: boolean
}

export function useCreateMonthlyBudget(): UseCreateMonthlyBudgetReturn {
  const queryClient = useQueryClient()

  const { mutateAsync, isPending } = useMutation({
    mutationFn: createMonthlyBudgetRecord,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: monthlyBudgetQueryKeys.listAll }),
        queryClient.invalidateQueries({ queryKey: monthlyBudgetQueryKeys.effectiveAll }),
      ])
    },
  })

  const createMonthlyBudget = useCallback(
    async (value: MonthlyBudgetWriteInput) => {
      return mutateAsync(value)
    },
    [mutateAsync],
  )

  return { createMonthlyBudget, isPending }
}
