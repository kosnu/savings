import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import { profileQueryKeys } from "./profileQueryKeys"
import { updateLanguage as updateLanguageRecord } from "./updateLanguage"

interface UseUpdateLanguageReturn {
  updateLanguage: (language: "en" | "ja") => Promise<void>
  isPending: boolean
}

class LanguageUpdateWriteError extends Error {
  readonly originalError: unknown

  constructor(cause: unknown) {
    super("Language update write failed.")
    this.name = "LanguageUpdateWriteError"
    this.originalError = cause
  }
}

export function isLanguageUpdateWriteFailure(error: unknown): boolean {
  return error instanceof LanguageUpdateWriteError
}

export function useUpdateLanguage(authUserId: string): UseUpdateLanguageReturn {
  const queryClient = useQueryClient()
  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (language: "en" | "ja") => {
      try {
        await updateLanguageRecord({ authUserId, language })
      } catch (error) {
        throw new LanguageUpdateWriteError(error)
      }

      void queryClient.invalidateQueries({
        queryKey: profileQueryKeys.current(authUserId),
        exact: true,
      })
    },
  })

  const updateLanguage = useCallback(
    async (language: "en" | "ja") => {
      await mutateAsync(language)
    },
    [mutateAsync],
  )
  return {
    updateLanguage,
    isPending,
  }
}
