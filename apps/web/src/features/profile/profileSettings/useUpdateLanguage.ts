import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import { profileQueryKeys } from "./profileQueryKeys"
import { updateLanguage as updateLanguageRecord } from "./updateLanguage"

interface UseUpdateLanguageReturn {
  updateLanguage: (language: "en" | "ja") => Promise<void>
  isPending: boolean
}

export function useUpdateLanguage(authUserId: string): UseUpdateLanguageReturn {
  const queryClient = useQueryClient()
  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (language: "en" | "ja") => {
      await updateLanguageRecord({ authUserId, language })
      await queryClient.refetchQueries(
        {
          queryKey: profileQueryKeys.current(authUserId),
          type: "all",
        },
        { throwOnError: true },
      )
    },
  })

  const updateLanguage = useCallback(
    async (language: "en" | "ja") => {
      await mutateAsync(language)
    },
    [mutateAsync],
  )

  return { updateLanguage, isPending }
}
