import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import type { MonthlyBudgetUpdateInput } from "./monthlyBudgetUpdateMappers"
import { updateMonthlyBudget as updateMonthlyBudgetRecord } from "./updateMonthlyBudget"

interface UseUpdateMonthlyBudgetReturn {
  updateMonthlyBudget: (value: MonthlyBudgetUpdateInput) => Promise<void>
  isPending: boolean
}

export function useUpdateMonthlyBudget(): UseUpdateMonthlyBudgetReturn {
  const queryClient = useQueryClient()

  const { mutateAsync, isPending } = useMutation({
    mutationFn: updateMonthlyBudgetRecord,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["monthlyBudgets"] })
    },
  })

  const updateMonthlyBudget = useCallback(
    async (value: MonthlyBudgetUpdateInput) => {
      return mutateAsync(value)
    },
    [mutateAsync],
  )

  return { updateMonthlyBudget, isPending }
}
