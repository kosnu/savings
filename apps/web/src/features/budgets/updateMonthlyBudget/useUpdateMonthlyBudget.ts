import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import { monthlyBudgetQueryKeys } from "../queryKeys"
import { updateCurrentMonthlyBudget as updateMonthlyBudgetRecord } from "./updateMonthlyBudget"

interface UseUpdateMonthlyBudgetReturn {
  updateMonthlyBudget: (amount: number) => Promise<void>
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
    async (amount: number) => {
      return mutateAsync(amount)
    },
    [mutateAsync],
  )

  return { updateMonthlyBudget, isPending }
}
