import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

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
      await queryClient.invalidateQueries({ queryKey: ["categorySettingsItems"] })
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
