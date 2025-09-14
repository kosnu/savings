import { getAuth, onAuthStateChanged } from "firebase/auth"
import { useCallback, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { paths } from "../../config/paths"
import { useFirestore } from "../../providers/firebase"
import { signIn } from "./signIn"

interface UseSignIn {
  signIn: () => Promise<void>
}

export function useSignIn(): UseSignIn {
  const db = useFirestore()
  const navigate = useNavigate()

  const signin = useCallback(async () => {
    try {
      await signIn(db)

      await navigate(paths.payments.getHref())
    } catch (error) {
      console.error("Error signing in:", error)
    }
  }, [db, navigate])

  // リロードや別ページから戻ってきたときに既にログイン済みならリダイレクトする
  useEffect(() => {
    const auth = getAuth()
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate(paths.payments.getHref())
      }
    })

    return () => unsubscribe()
  }, [navigate])

  return {
    signIn: signin,
  }
}
