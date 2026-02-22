import { getAuth, onAuthStateChanged, type User } from "firebase/auth"
import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { paths } from "../../config/paths"
import { useSupabaseSession } from "../../providers/supabase"

export function useAuthCheck() {
  const navigate = useNavigate()
  const { session: supabaseSession, loading: supabaseLoading } =
    useSupabaseSession()

  useEffect(() => {
    if (supabaseLoading) return

    const auth = getAuth()
    let firebaseUser: User | null | undefined
    let isActive = true

    const evaluateAuthState = () => {
      if (!isActive) return
      if (firebaseUser === undefined) return
      if (!firebaseUser && !supabaseSession) {
        navigate(paths.root.getHref())
      }
    }

    const unsubscribeFirebase = onAuthStateChanged(auth, (user) => {
      firebaseUser = user
      evaluateAuthState()
    })

    evaluateAuthState()

    return () => {
      isActive = false
      unsubscribeFirebase()
    }
  }, [navigate, supabaseSession, supabaseLoading])
}
