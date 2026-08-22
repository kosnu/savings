import { useQuery } from "@tanstack/react-query"
import { type ReactNode, useEffect, useRef, useState } from "react"

import { fetchProfile, profileQueryKeys } from "../../features/profile"
import { i18next } from "../../i18n"
import { useSupabaseSession } from "../supabase/useSupabaseSession"

interface LanguageSyncProviderProps {
  children: ReactNode
}

export function LanguageSyncProvider({ children }: LanguageSyncProviderProps) {
  const { authenticationGeneration, session, status } = useSupabaseSession()
  const authUserId = session?.user.id
  const authenticationIdentity =
    authUserId === undefined ? null : `${authUserId}:${authenticationGeneration}`
  const [readyAuthenticationIdentity, setReadyAuthenticationIdentity] = useState<string | null>(
    null,
  )
  const [revalidatedAuthenticationIdentity, setRevalidatedAuthenticationIdentity] = useState<
    string | null
  >(null)
  const [resolvedSnapshot, setResolvedSnapshot] = useState<string | null>(null)
  const languageSyncQueueRef = useRef(Promise.resolve())

  const {
    data: profile,
    dataUpdatedAt,
    isError,
    isFetching,
    isRefetchError,
    refetch,
  } = useQuery({
    queryKey: profileQueryKeys.current(authUserId ?? ""),
    queryFn: async () => fetchProfile(authUserId ?? ""),
    enabled: status === "authenticated" && authUserId !== undefined,
    staleTime: 3000,
    refetchOnMount: "always",
  })

  const profileLanguage = profile?.language
  const hasFallback =
    isError || isRefetchError || profileLanguage === undefined || profileLanguage === null
  const snapshot =
    authUserId !== undefined && profileLanguage !== undefined && profileLanguage !== null
      ? `${authUserId}:${profileLanguage}:${dataUpdatedAt}`
      : null

  useEffect(() => {
    if (status === "authenticated") return

    let isActive = true
    queueMicrotask(() => {
      if (!isActive) return
      setReadyAuthenticationIdentity(null)
      setRevalidatedAuthenticationIdentity(null)
      setResolvedSnapshot(null)
    })

    return () => {
      isActive = false
    }
  }, [status])

  useEffect(() => {
    if (status !== "authenticated" || authenticationIdentity === null) return

    let isActive = true
    void refetch().finally(() => {
      if (isActive) setRevalidatedAuthenticationIdentity(authenticationIdentity)
    })

    return () => {
      isActive = false
    }
  }, [authenticationIdentity, refetch, status])

  useEffect(() => {
    if (
      status !== "authenticated" ||
      authUserId === undefined ||
      authenticationIdentity === null ||
      revalidatedAuthenticationIdentity !== authenticationIdentity
    )
      return

    if (isFetching) return

    if (hasFallback) {
      let isActive = true
      queueMicrotask(() => {
        if (isActive) setReadyAuthenticationIdentity(authenticationIdentity)
      })
      return () => {
        isActive = false
      }
    }

    if (snapshot === null || resolvedSnapshot === snapshot) return

    let isActive = true

    languageSyncQueueRef.current = languageSyncQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        if (!isActive) return

        try {
          await i18next.changeLanguage(profileLanguage)
        } finally {
          if (isActive) {
            setReadyAuthenticationIdentity(authenticationIdentity)
            setResolvedSnapshot(snapshot)
          }
        }
      })

    return () => {
      isActive = false
    }
  }, [
    authUserId,
    authenticationIdentity,
    hasFallback,
    isFetching,
    profileLanguage,
    revalidatedAuthenticationIdentity,
    resolvedSnapshot,
    snapshot,
    status,
  ])

  const canRenderChildren =
    status === "unauthenticated" ||
    (status === "authenticated" &&
      authenticationIdentity !== null &&
      readyAuthenticationIdentity === authenticationIdentity)

  return canRenderChildren ? <>{children}</> : null
}
