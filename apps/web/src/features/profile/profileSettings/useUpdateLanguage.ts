import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import { profileQueryKeys } from "./profileQueryKeys"
import { updateLanguage as updateLanguageRecord } from "./updateLanguage"

interface UseUpdateLanguageReturn {
  updateLanguage: (language: "en" | "ja") => Promise<void>
  isPending: boolean
}

type LanguageUpdateFailurePhase = "write" | "verification"

class LanguageUpdateError extends Error {
  readonly phase: LanguageUpdateFailurePhase
  readonly originalError: unknown

  constructor(phase: LanguageUpdateFailurePhase, cause: unknown) {
    super(`Language update ${phase} failed.`)
    this.name = "LanguageUpdateError"
    this.phase = phase
    this.originalError = cause
  }
}

export function isLanguageUpdateWriteFailure(error: unknown): boolean {
  return error instanceof LanguageUpdateError && error.phase === "write"
}

export function useUpdateLanguage(authUserId: string): UseUpdateLanguageReturn {
  const queryClient = useQueryClient()
  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (language: "en" | "ja") => {
      try {
        await updateLanguageRecord({ authUserId, language })
      } catch (error) {
        throw new LanguageUpdateError("write", error)
      }

      try {
        await queryClient.refetchQueries(
          {
            queryKey: profileQueryKeys.current(authUserId),
            type: "all",
          },
          { throwOnError: true },
        )
      } catch (error) {
        throw new LanguageUpdateError("verification", error)
      }
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
