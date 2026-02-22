import type { Session } from "@supabase/supabase-js"
import { createContext, type ReactNode, useEffect, useState } from "react"
import { getSupabaseClient } from "../../lib/supabase"

export interface SupabaseSessionState {
  session: Session | null
  loading: boolean
}

export const SupabaseSessionContext = createContext<
  SupabaseSessionState | undefined
>(undefined)

interface SupabaseSessionProviderProps {
  children: ReactNode
}

export function SupabaseSessionProvider({
  children,
}: SupabaseSessionProviderProps) {
  const [state, setState] = useState<SupabaseSessionState>({
    session: null,
    loading: true,
  })

  useEffect(() => {
    const supabase = getSupabaseClient()

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Failed to get supabase session:", error)
        setState({ session: null, loading: false })
        return
      }
      setState({ session: data.session, loading: false })
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, loading: false })
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return (
    <SupabaseSessionContext value={state}>{children}</SupabaseSessionContext>
  )
}
