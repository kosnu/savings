import { getAuth, onAuthStateChanged, type User } from "firebase/auth"
import { useEffect, useState } from "react"

interface UseAuthCurrentUserReturn {
  currentUser: User | null
}

export function useAuthCurrentUser(): UseAuthCurrentUserReturn {
  const auth = getAuth()
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setCurrentUser(user)
      },
      (error) => {
        console.error("Failed to listen to auth state changes:", error)
      },
    )
    return () => unsubscribe()
  }, [auth])

  return {
    currentUser: currentUser,
  }
}
