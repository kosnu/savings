import { queryOptions } from "@tanstack/react-query"

import { fetchLanguagePreference } from "./fetchLanguagePreference"
import { languagePreferenceQueryKeys } from "./languagePreferenceQueryKeys"

export function languagePreferenceQueryOptions(authUserId: string) {
  return queryOptions({
    queryKey: languagePreferenceQueryKeys.current(authUserId),
    queryFn: async () => fetchLanguagePreference(authUserId),
  })
}
