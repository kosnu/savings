import { isAuthApiError, isAuthSessionMissingError, type Session } from "@supabase/supabase-js"
import { useQueryClient } from "@tanstack/react-query"
import { createContext, type ReactNode, useEffect, useRef, useState } from "react"

import { toInitialDisplayName } from "../../domain/displayName"
import { i18next } from "../../i18n"
import { loadAccountLanguage, resolveAccountLanguage } from "../../i18n/accountLanguage"
import { captureSupabaseSessionError } from "../../lib/sentry"
import { getSupabaseClient } from "../../lib/supabase"
import { ensureAuthenticatedUser } from "./ensureAuthenticatedUser"

export type AuthStatus = "loading" | "unauthenticated" | "authenticated" | "error"

export type SupabaseSessionState =
  | { status: Exclude<AuthStatus, "error">; session: Session | null }
  | { status: "error"; session: null; requiresSignIn: boolean; retry: () => void }

export const SupabaseSessionContext = createContext<SupabaseSessionState | undefined>(undefined)

interface SupabaseSessionProviderProps {
  children: ReactNode
}

const initialSessionState: SupabaseSessionState = {
  status: "loading",
  session: null,
}

const unauthenticatedSessionState: SupabaseSessionState = {
  status: "unauthenticated",
  session: null,
}

export function SupabaseSessionProvider({ children }: SupabaseSessionProviderProps) {
  const queryClient = useQueryClient()
  const sessionGenerationRef = useRef(0)
  const stateRef = useRef<SupabaseSessionState>(initialSessionState)
  const [state, setState] = useState<SupabaseSessionState>(initialSessionState)

  useEffect(() => {
    const supabase = getSupabaseClient()
    let isActive = true

    const setSessionState = (nextState: SupabaseSessionState) => {
      if (stateRef.current.session?.user.id !== nextState.session?.user.id) {
        queryClient.clear()
      }
      stateRef.current = nextState
      setState(nextState)
    }

    const handleSessionError = (
      error: unknown,
      sessionGeneration = sessionGenerationRef.current,
    ) => {
      captureSupabaseSessionError(error)
      if (!isActive) return
      if (sessionGenerationRef.current !== sessionGeneration) return

      if (stateRef.current.status !== "authenticated") {
        setSessionState({
          status: "error",
          session: null,
          requiresSignIn: needsSignIn(error),
          retry,
        })
      }
    }

    const isCurrentSessionHandler = (sessionGeneration: number) =>
      isActive && sessionGenerationRef.current === sessionGeneration

    const verifyAuthenticatedSession = async (session: Session): Promise<string> => {
      const { error: getUserError } = await supabase.auth.getUser()
      if (getUserError) {
        throw getUserError
      }

      await ensureAuthenticatedUser(
        toInitialDisplayName({
          name: session.user.user_metadata.name,
          fullName: session.user.user_metadata.full_name,
          email: session.user.email,
        }),
      )

      const deviceLanguage = i18next.resolvedLanguage
      try {
        const accountLanguage = await loadAccountLanguage(session.user.id)
        return resolveAccountLanguage(accountLanguage, deviceLanguage)
      } catch (error) {
        captureSupabaseSessionError(error)
        return resolveAccountLanguage(undefined, deviceLanguage)
      }
    }

    const handleSessionVerificationError = (
      error: unknown,
      sessionGeneration: number,
      shouldKeepCurrentSession: boolean,
    ) => {
      captureSupabaseSessionError(error)

      if (!isCurrentSessionHandler(sessionGeneration)) return
      // 同じユーザーの更新失敗では、検証前の有効な session を維持する。
      const requiresSignIn = needsSignIn(error)
      if (shouldKeepCurrentSession && !requiresSignIn) return

      setSessionState({ status: "error", session: null, requiresSignIn, retry })
    }

    const handleSession = async (session: Session | null, sessionGeneration: number) => {
      if (!isCurrentSessionHandler(sessionGeneration)) return

      if (!session) {
        if (stateRef.current.status === "error" && stateRef.current.requiresSignIn) return
        setSessionState(unauthenticatedSessionState)
        return
      }

      const currentState = stateRef.current
      const shouldKeepCurrentSession = isSameAuthenticatedUser(currentState, session)

      if (!shouldKeepCurrentSession) {
        setSessionState({ status: "loading", session: null })
      }

      try {
        const resolvedLanguage = await verifyAuthenticatedSession(session)
        if (!isCurrentSessionHandler(sessionGeneration)) return

        await i18next.changeLanguage(resolvedLanguage)
        if (!isCurrentSessionHandler(sessionGeneration)) return

        setSessionState(toAuthenticatedSessionState(session))
      } catch (error) {
        handleSessionVerificationError(error, sessionGeneration, shouldKeepCurrentSession)
      }
    }

    const loadSession = async (sessionGeneration: number) => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) {
          handleSessionError(error, sessionGeneration)
          return
        }
        if (!isCurrentSessionHandler(sessionGeneration)) return

        await handleSession(data.session, sessionGeneration)
      } catch (error) {
        handleSessionError(error, sessionGeneration)
      }
    }

    const retry = () => {
      if (!isActive || stateRef.current.status !== "error") return

      sessionGenerationRef.current += 1
      setSessionState(initialSessionState)
      void loadSession(sessionGenerationRef.current)
    }

    void loadSession(sessionGenerationRef.current)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // 初期通知のnullは取得失敗でも届くため、未ログインの確定はgetSessionに任せる。
      if (event === "INITIAL_SESSION" && !session) return

      sessionGenerationRef.current += 1
      // 検証中にSDKが無効なsessionを破棄した場合も、再認証の理由を残す。
      if (event === "SIGNED_OUT" && stateRef.current.status === "loading") {
        setSessionState({ status: "error", session: null, requiresSignIn: true, retry })
        return
      }
      void handleSession(session, sessionGenerationRef.current)
    })

    return () => {
      isActive = false
      subscription.unsubscribe()
    }
  }, [queryClient])

  return <SupabaseSessionContext value={state}>{children}</SupabaseSessionContext>
}

function needsSignIn(error: unknown): boolean {
  return (
    isAuthSessionMissingError(error) ||
    (isAuthApiError(error) && (error.status === 401 || error.status === 403))
  )
}

function isSameAuthenticatedUser(currentState: SupabaseSessionState, session: Session): boolean {
  return (
    currentState.status === "authenticated" && currentState.session?.user.id === session.user.id
  )
}

function toAuthenticatedSessionState(session: Session): SupabaseSessionState {
  return {
    status: "authenticated",
    session,
  }
}
