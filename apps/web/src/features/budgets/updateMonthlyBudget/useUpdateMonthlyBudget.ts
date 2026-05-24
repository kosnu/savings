import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import { monthlyBudgetQueryKeys } from "../queryKeys"
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: monthlyBudgetQueryKeys.listAll }),
        queryClient.invalidateQueries({ queryKey: monthlyBudgetQueryKeys.effectiveAll }),
      ])
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
