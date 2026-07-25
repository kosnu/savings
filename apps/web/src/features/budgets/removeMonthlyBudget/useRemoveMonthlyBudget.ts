import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import { invalidateMonthlyBudgetQueries } from "../queryKeys"
import { removeMonthlyBudget as removeMonthlyBudgetRecord } from "./removeMonthlyBudget"

interface UseRemoveMonthlyBudgetReturn {
  removeMonthlyBudget: () => Promise<void>
  isPending: boolean
}

export function useRemoveMonthlyBudget(): UseRemoveMonthlyBudgetReturn {
  const queryClient = useQueryClient()

  const { mutateAsync, isPending } = useMutation({
    mutationFn: removeMonthlyBudgetRecord,
    onSuccess: async () => {
      await invalidateMonthlyBudgetQueries(queryClient)
    },
  })

  const removeMonthlyBudget = useCallback(async () => {
    return mutateAsync()
  }, [mutateAsync])

  return { removeMonthlyBudget, isPending }
}
