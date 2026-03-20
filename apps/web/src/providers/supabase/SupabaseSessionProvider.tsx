import type { Session } from "@supabase/supabase-js"
import { createContext, type ReactNode, useEffect, useState } from "react"

import { captureSupabaseSessionError } from "../../lib/sentry"
import { getSupabaseClient } from "../../lib/supabase"

export type AuthStatus = "loading" | "unauthenticated" | "authenticated"

export interface SupabaseSessionState {
  status: AuthStatus
  session: Session | null
}

export const SupabaseSessionContext = createContext<SupabaseSessionState | undefined>(undefined)

interface SupabaseSessionProviderProps {
  children: ReactNode
}

export function SupabaseSessionProvider({ children }: SupabaseSessionProviderProps) {
  const [state, setState] = useState<SupabaseSessionState>({
    status: "loading",
    session: null,
  })

  useEffect(() => {
    const supabase = getSupabaseClient()

    const handleSessionError = (error: unknown) => {
      captureSupabaseSessionError(error)
      setState((currentState) =>
        currentState.status === "loading"
          ? { status: "unauthenticated", session: null }
          : currentState,
      )
    }

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          handleSessionError(error)
          return
        }
        setState(toSupabaseSessionState(data.session))
      })
      .catch(handleSessionError)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(toSupabaseSessionState(session))
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return <SupabaseSessionContext value={state}>{children}</SupabaseSessionContext>
}

function toSupabaseSessionState(session: Session | null): SupabaseSessionState {
  return {
    status: session ? "authenticated" : "unauthenticated",
    session,
  }
}
