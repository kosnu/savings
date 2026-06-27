import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import { monthlyBudgetQueryKeys } from "../queryKeys"
import {
  type MonthlyBudgetRemoveInput,
  removeMonthlyBudget as removeMonthlyBudgetRecord,
} from "./removeMonthlyBudget"

interface UseRemoveMonthlyBudgetReturn {
  removeMonthlyBudget: (value: MonthlyBudgetRemoveInput) => Promise<void>
  isPending: boolean
}

export function useRemoveMonthlyBudget(): UseRemoveMonthlyBudgetReturn {
  const queryClient = useQueryClient()

  const { mutateAsync, isPending } = useMutation({
    mutationFn: removeMonthlyBudgetRecord,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: monthlyBudgetQueryKeys.listAll }),
        queryClient.invalidateQueries({ queryKey: monthlyBudgetQueryKeys.effectiveAll }),
      ])
    },
  })

  const removeMonthlyBudget = useCallback(
    async (value: MonthlyBudgetRemoveInput) => {
      return mutateAsync(value)
    },
    [mutateAsync],
  )

  return { removeMonthlyBudget, isPending }
}
