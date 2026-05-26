import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import { summaryQueryKeys } from "../../summaryByMonth/queryKeys"
import { invalidateCategoryQueries } from "../queryKeys"
import type { CategoryUpdateInput } from "./categoryUpdateMappers"
import { updateCategory as updateCategoryRecord } from "./updateCategory"

interface UseUpdateCategoryReturn {
  updateCategory: (value: CategoryUpdateInput) => Promise<void>
  isPending: boolean
}

export function useUpdateCategory(): UseUpdateCategoryReturn {
  const queryClient = useQueryClient()

  const { mutateAsync, isPending } = useMutation({
    mutationFn: updateCategoryRecord,
    onSuccess: async () => {
      await Promise.all([
        invalidateCategoryQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: summaryQueryKeys.categoryTotalsAll }),
      ])
    },
  })

  const updateCategory = useCallback(
    async (value: CategoryUpdateInput) => {
      return mutateAsync(value)
    },
    [mutateAsync],
  )

  return { updateCategory, isPending }
}
