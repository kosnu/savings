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

    let isActive = true

    const evaluateAuthState = () => {
      if (!isActive) return
      if (!supabaseSession) {
        navigate(paths.root.getHref())
      }
    }

    evaluateAuthState()

    return () => {
      isActive = false
    }
  }, [navigate, supabaseSession, supabaseLoading])
}
