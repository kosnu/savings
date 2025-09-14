import { getAuth, onAuthStateChanged } from "firebase/auth"
import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { paths } from "../../config/paths"

export function useAuthCheck() {
  const navigate = useNavigate()

  useEffect(() => {
    const auth = getAuth()
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate(paths.root.getHref())
      }
    })

    return () => unsubscribe()
  }, [navigate])
}
