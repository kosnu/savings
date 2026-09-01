import { useSuspenseQuery } from "@tanstack/react-query"

import { fetchProfile } from "./fetchProfile"
import { profileQueryKeys } from "./profileQueryKeys"
import type { Profile } from "./profileSchema"

interface UseProfileReturn {
  data: Profile
}

export function useProfile(authUserId: string): UseProfileReturn {
  const query = useSuspenseQuery({
    queryKey: profileQueryKeys.current(authUserId),
    queryFn: async () => fetchProfile(authUserId),
    staleTime: 3000,
  })

  return { data: query.data }
}
