import { useQuery } from "@tanstack/react-query"

import type { AppLanguage } from "../../../i18n"
import { languagePreferenceQueryOptions } from "./languagePreferenceQueryOptions"

interface UseLanguagePreferenceReturn {
  language: AppLanguage | null | undefined
  error: Error | null
  isPending: boolean
}

export function useLanguagePreference(authUserId: string | null): UseLanguagePreferenceReturn {
  const query = useQuery({
    ...languagePreferenceQueryOptions(authUserId ?? "unauthenticated"),
    enabled: authUserId !== null,
  })

  return {
    language: query.data,
    error: query.error,
    isPending: authUserId !== null && query.isPending,
  }
}
