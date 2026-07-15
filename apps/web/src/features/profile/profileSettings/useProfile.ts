import { useQuery } from "@tanstack/react-query"

import { fetchProfile } from "./fetchProfile"
import { profileQueryKeys } from "./profileQueryKeys"
import type { Profile } from "./profileSchema"

interface UseProfileReturn {
  promise: Promise<Profile>
}

export function useProfile(authUserId: string): UseProfileReturn {
  const query = useQuery({
    queryKey: profileQueryKeys.current(authUserId),
    queryFn: async () => fetchProfile(authUserId),
    staleTime: 3000,
  })

  return { promise: query.promise }
}
