import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import { summaryQueryKeys } from "../../summaryByMonth/queryKeys"
import { invalidateCategoryQueries } from "../queryKeys"
import {
  type CategoryPinUpdateInput,
  updateCategoryPin as updateCategoryPinRecord,
} from "./updateCategoryPin"

interface UseUpdateCategoryPinReturn {
  updateCategoryPin: (value: CategoryPinUpdateInput) => Promise<void>
  isPending: boolean
}

export function useUpdateCategoryPin(): UseUpdateCategoryPinReturn {
  const queryClient = useQueryClient()

  const { mutateAsync, isPending } = useMutation({
    mutationFn: updateCategoryPinRecord,
    onSuccess: async () => {
      await Promise.all([
        invalidateCategoryQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: summaryQueryKeys.categoryTotalsAll }),
      ])
    },
  })

  const updateCategoryPin = useCallback(
    async (value: CategoryPinUpdateInput) => {
      return mutateAsync(value)
    },
    [mutateAsync],
  )

  return { updateCategoryPin, isPending }
}
