import type { Session } from "@supabase/supabase-js"
import { createContext, type ReactNode, useEffect, useRef, useState } from "react"

import { captureSupabaseSessionError } from "../../lib/sentry"
import { getSupabaseClient } from "../../lib/supabase"
import { ensureAuthenticatedUser } from "./ensureAuthenticatedUser"

export type AuthStatus = "loading" | "unauthenticated" | "authenticated"

export interface SupabaseSessionState {
  status: AuthStatus
  session: Session | null
}

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
  const sessionGenerationRef = useRef(0)
  const stateRef = useRef<SupabaseSessionState>(initialSessionState)
  const [state, setState] = useState<SupabaseSessionState>(initialSessionState)

  useEffect(() => {
    const supabase = getSupabaseClient()
    let isActive = true

    const setSessionState = (nextState: SupabaseSessionState) => {
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

      if (stateRef.current.status === "loading") {
        setSessionState(unauthenticatedSessionState)
      }
    }

    const isCurrentSessionHandler = (sessionGeneration: number) =>
      isActive && sessionGenerationRef.current === sessionGeneration

    const verifyAuthenticatedSession = async () => {
      const { error: getUserError } = await supabase.auth.getUser()
      if (getUserError) {
        throw getUserError
      }

      await ensureAuthenticatedUser()
    }

    const signOutCurrentSession = async (): Promise<boolean> => {
      try {
        const { error } = await supabase.auth.signOut()
        if (error) {
          captureSupabaseSessionError(error)
          return false
        }

        return true
      } catch (signOutError) {
        captureSupabaseSessionError(signOutError)
        return false
      }
    }

    const handleSessionVerificationError = async (
      error: unknown,
      sessionGeneration: number,
      shouldKeepCurrentSession: boolean,
    ) => {
      captureSupabaseSessionError(error)

      // signOut は Supabase の現在 session に作用するため、古い handler では実行しない。
      if (!isCurrentSessionHandler(sessionGeneration)) return
      // 同じユーザーの更新失敗では、検証前の有効な session を維持する。
      if (shouldKeepCurrentSession) return

      const didSignOut = await signOutCurrentSession()
      if (!didSignOut) return

      // signOut の待機中に新しい session が来た場合、古い handler で画面状態を戻さない。
      if (!isCurrentSessionHandler(sessionGeneration)) return

      setSessionState(unauthenticatedSessionState)
    }

    const handleSession = async (session: Session | null, sessionGeneration: number) => {
      if (!isCurrentSessionHandler(sessionGeneration)) return

      if (!session) {
        setSessionState(unauthenticatedSessionState)
        return
      }

      const currentState = stateRef.current
      const shouldKeepCurrentSession = isSameAuthenticatedUser(currentState, session)

      if (!shouldKeepCurrentSession) {
        setSessionState({ status: "loading", session: null })
      }

      try {
        await verifyAuthenticatedSession()
        if (!isCurrentSessionHandler(sessionGeneration)) return

        setSessionState(toAuthenticatedSessionState(session))
      } catch (error) {
        await handleSessionVerificationError(error, sessionGeneration, shouldKeepCurrentSession)
      }
    }

    const getSessionGeneration = sessionGenerationRef.current

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          handleSessionError(error, getSessionGeneration)
          return
        }
        if (sessionGenerationRef.current !== getSessionGeneration) return

        void handleSession(data.session, getSessionGeneration)
      })
      .catch((error: unknown) => handleSessionError(error, getSessionGeneration))

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      sessionGenerationRef.current += 1
      void handleSession(session, sessionGenerationRef.current)
    })

    return () => {
      isActive = false
      subscription.unsubscribe()
    }
  }, [])

  return <SupabaseSessionContext value={state}>{children}</SupabaseSessionContext>
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
