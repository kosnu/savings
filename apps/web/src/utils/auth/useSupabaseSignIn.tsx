import { useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

import { startExplicitLogin } from "../../lib/explicitLogin"
import { getSupabaseClient } from "../../lib/supabase"

interface UseSupabaseSignIn {
  signIn: () => Promise<void>
}

export function useSupabaseSignIn(): UseSupabaseSignIn {
  const navigate = useNavigate()
  const supabase = getSupabaseClient()

  useEffect(() => {
    let isActive = true

    const handleSession = (hasSession: boolean) => {
      if (!isActive || !hasSession) return
      void navigate({ to: "/payments" })
    }

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          console.error("Failed to get supabase session:", error)
          return
        }
        handleSession(Boolean(data.session))
      })
      .catch((error) => {
        console.error("Failed to get supabase session:", error)
      })

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(Boolean(session))
    })

    return () => {
      isActive = false
      authListener.subscription.unsubscribe()
    }
  }, [supabase, navigate])

  return {
    signIn: startExplicitLogin,
  }
}
