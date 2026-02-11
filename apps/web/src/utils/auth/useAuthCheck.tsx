import type { Session } from "@supabase/supabase-js"
import { getAuth, onAuthStateChanged, type User } from "firebase/auth"
import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { paths } from "../../config/paths"
import { getSupabaseClient } from "../../lib/supabase"

export function useAuthCheck() {
  const navigate = useNavigate()

  useEffect(() => {
    const auth = getAuth()
    const supabase = getSupabaseClient()
    let firebaseUser: User | null | undefined = undefined
    let supabaseSession: Session | null | undefined = undefined
    let isActive = true

    const evaluateAuthState = () => {
      if (!isActive) return
      if (firebaseUser === undefined || supabaseSession === undefined) return
      if (!firebaseUser && !supabaseSession) {
        navigate(paths.root.getHref())
      }
    }

    const unsubscribeFirebase = onAuthStateChanged(auth, (user) => {
      firebaseUser = user
      evaluateAuthState()
    })

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          console.error("Failed to get supabase session:", error)
          supabaseSession = null
          evaluateAuthState()
          return
        }
        supabaseSession = data.session
        evaluateAuthState()
      })
      .catch((error) => {
        console.error("Failed to get supabase session:", error)
        supabaseSession = null
        evaluateAuthState()
      })

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        supabaseSession = session
        evaluateAuthState()
      },
    )

    return () => {
      isActive = false
      unsubscribeFirebase()
      authListener.subscription.unsubscribe()
    }
  }, [navigate])
}
