import { useQuery } from "@tanstack/react-query"
import { type ReactNode, useEffect, useRef } from "react"

import { fetchProfile } from "../../features/profile/profileSettings/fetchProfile"
import { profileQueryKeys } from "../../features/profile/profileSettings/profileQueryKeys"
import { i18next } from "../../i18n"
import { useSupabaseSession } from "../supabase/useSupabaseSession"

interface LanguageSyncProviderProps {
  children: ReactNode
}

export function LanguageSyncProvider({ children }: LanguageSyncProviderProps) {
  const { session, status } = useSupabaseSession()
  const authUserId = session?.user.id
  const appliedUserIdRef = useRef<string | null>(null)

  const { data: profile } = useQuery({
    queryKey: profileQueryKeys.current(authUserId ?? ""),
    queryFn: async () => fetchProfile(authUserId ?? ""),
    enabled: status === "authenticated" && authUserId !== undefined,
    staleTime: 3000,
  })

  useEffect(() => {
    if (status !== "authenticated" || authUserId === undefined) {
      appliedUserIdRef.current = null
      return
    }

    if (profile === undefined || appliedUserIdRef.current === authUserId) return

    appliedUserIdRef.current = authUserId
    if (profile.language !== null) {
      void i18next.changeLanguage(profile.language)
    }
  }, [authUserId, profile, status])

  return <>{children}</>
}
