import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import { summaryQueryKeys } from "../../summaryByMonth/queryKeys"
import { invalidateCategoryQueries } from "../queryKeys"
import type { CategoryCreateValues } from "./categoryCreateSchema"
import { createCategory as createCategoryRecord } from "./createCategory"

interface UseCreateCategoryReturn {
  createCategory: (value: CategoryCreateValues) => Promise<number>
  isPending: boolean
}

export function useCreateCategory(): UseCreateCategoryReturn {
  const queryClient = useQueryClient()

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (value: CategoryCreateValues) => createCategoryRecord(value),
    onSuccess: async () => {
      await Promise.all([
        invalidateCategoryQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: summaryQueryKeys.categoryTotalsAll }),
      ])
    },
  })

  const createCategory = useCallback(
    async (value: CategoryCreateValues) => {
      return mutateAsync(value)
    },
    [mutateAsync],
  )

  return { createCategory, isPending }
}
