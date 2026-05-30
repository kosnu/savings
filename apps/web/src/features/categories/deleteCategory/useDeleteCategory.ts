import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import { paymentQueryKeys } from "../../payments/queryKeys"
import { summaryQueryKeys } from "../../summaryByMonth/queryKeys"
import { categoryQueryKeys } from "../queryKeys"
import { deleteCategory as deleteCategoryRecord } from "./deleteCategory"

interface UseDeleteCategoryReturn {
  deleteCategory: (categoryId: number) => Promise<void>
  isPending: boolean
}

export function useDeleteCategory(): UseDeleteCategoryReturn {
  const queryClient = useQueryClient()

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (categoryId: number) => deleteCategoryRecord(categoryId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: categoryQueryKeys.all,
          refetchType: "all",
        }),
        queryClient.invalidateQueries({ queryKey: paymentQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: paymentQueryKeys.detailsAll }),
        queryClient.invalidateQueries({ queryKey: summaryQueryKeys.categoryTotalsAll }),
      ])
    },
  })

  const deleteCategory = useCallback(
    async (categoryId: number) => {
      return mutateAsync(categoryId)
    },
    [mutateAsync],
  )

  return { deleteCategory, isPending }
}
