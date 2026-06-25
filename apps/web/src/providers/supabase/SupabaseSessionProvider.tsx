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

    const handleSession = async (session: Session | null, sessionGeneration: number) => {
      const isLatestSessionGeneration = () => sessionGenerationRef.current === sessionGeneration

      if (!isActive) return
      if (!isLatestSessionGeneration()) return

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
        const { error: getUserError } = await supabase.auth.getUser()
        if (getUserError) {
          throw getUserError
        }

        await ensureAuthenticatedUser()
        if (!isActive) return
        if (!isLatestSessionGeneration()) return

        setSessionState(toAuthenticatedSessionState(session))
      } catch (error) {
        captureSupabaseSessionError(error)
        try {
          await supabase.auth.signOut()
        } catch (signOutError) {
          captureSupabaseSessionError(signOutError)
        }
        if (!isActive) return
        if (!isLatestSessionGeneration()) return
        if (shouldKeepCurrentSession) return

        setSessionState(unauthenticatedSessionState)
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
