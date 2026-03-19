import type { Session } from "@supabase/supabase-js"
import { createContext, type ReactNode, useEffect, useState } from "react"

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

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Failed to get supabase session:", error)
        setState({ status: "unauthenticated", session: null })
        return
      }
      setState(toSupabaseSessionState(data.session))
    })

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
