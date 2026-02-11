import { useCallback, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { paths } from "../../config/paths"
import { getSupabaseClient } from "../../lib/supabase"

interface UseSupabaseSignIn {
  signIn: () => Promise<void>
}

export function useSupabaseSignIn(): UseSupabaseSignIn {
  const navigate = useNavigate()
  const supabase = getSupabaseClient()

  const signIn = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // NOTE: Supabase のダッシュボードで設定したリダイレクト URL に一致させる必要があります
        redirectTo: `${window.location.origin}${paths.payments.getHref()}`,
      },
    })

    if (error) {
      throw error
    }
  }, [supabase])

  useEffect(() => {
    let isActive = true

    const handleSession = (hasSession: boolean) => {
      if (!isActive || !hasSession) return
      navigate(paths.payments.getHref())
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

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        handleSession(Boolean(session))
      },
    )

    return () => {
      isActive = false
      authListener.subscription.unsubscribe()
    }
  }, [navigate, supabase])

  return {
    signIn: signIn,
  }
}
