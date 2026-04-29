import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import type { CategoryBudgetWriteInput } from "./categoryBudgetFormMappers"
import { createCategoryBudget as createCategoryBudgetRecord } from "./createCategoryBudget"

interface UseCreateCategoryBudgetReturn {
  createCategoryBudget: (value: CategoryBudgetWriteInput) => Promise<void>
  isPending: boolean
}

export function useCreateCategoryBudget(): UseCreateCategoryBudgetReturn {
  const queryClient = useQueryClient()

  const { mutateAsync, isPending } = useMutation({
    mutationFn: createCategoryBudgetRecord,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["categoryBudgets"] })
    },
  })

  const createCategoryBudget = useCallback(
    async (value: CategoryBudgetWriteInput) => {
      return mutateAsync(value)
    },
    [mutateAsync],
  )

  return { createCategoryBudget, isPending }
}
