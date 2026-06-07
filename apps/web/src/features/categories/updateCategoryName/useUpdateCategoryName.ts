import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import { paymentQueryKeys } from "../../payments"
import { summaryQueryKeys } from "../../summaryByMonth"
import { invalidateCategoryQueries } from "../queryKeys"
import type { CategoryNameUpdateInput } from "./categoryNameUpdateMappers"
import { updateCategoryName as updateCategoryNameRecord } from "./updateCategoryName"

interface UseUpdateCategoryNameReturn {
  updateCategoryName: (value: CategoryNameUpdateInput) => Promise<void>
  isPending: boolean
}

export function useUpdateCategoryName(): UseUpdateCategoryNameReturn {
  const queryClient = useQueryClient()

  const { mutateAsync, isPending } = useMutation({
    mutationFn: updateCategoryNameRecord,
    onSuccess: async () => {
      await Promise.all([
        invalidateCategoryQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: paymentQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: paymentQueryKeys.detailsAll }),
        queryClient.invalidateQueries({ queryKey: summaryQueryKeys.categoryTotalsAll }),
      ])
    },
  })

  const updateCategoryName = useCallback(
    async (value: CategoryNameUpdateInput) => {
      return mutateAsync(value)
    },
    [mutateAsync],
  )

  return { updateCategoryName, isPending }
}
