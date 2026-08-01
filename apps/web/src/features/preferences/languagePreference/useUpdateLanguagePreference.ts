import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import type { AppLanguage } from "../../../i18n"
import { languagePreferenceQueryKeys } from "./languagePreferenceQueryKeys"
import { updateLanguagePreference as updateLanguagePreferenceRecord } from "./updateLanguagePreference"

interface UseUpdateLanguagePreferenceReturn {
  updateLanguagePreference: (language: AppLanguage) => Promise<AppLanguage>
  isPending: boolean
}

export function useUpdateLanguagePreference(authUserId: string): UseUpdateLanguagePreferenceReturn {
  const queryClient = useQueryClient()
  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (language: AppLanguage) => {
      await updateLanguagePreferenceRecord({ authUserId, language })
      const queryKey = languagePreferenceQueryKeys.current(authUserId)
      await queryClient.refetchQueries(
        { exact: true, queryKey, type: "all" },
        { throwOnError: true },
      )
      const confirmedLanguage = queryClient.getQueryData<AppLanguage | null>(queryKey)

      if (confirmedLanguage !== language) {
        throw new Error("Unable to confirm saved language preference.")
      }

      return confirmedLanguage
    },
  })

  const updateLanguagePreference = useCallback(
    async (language: AppLanguage) => await mutateAsync(language),
    [mutateAsync],
  )

  return { updateLanguagePreference, isPending }
}
