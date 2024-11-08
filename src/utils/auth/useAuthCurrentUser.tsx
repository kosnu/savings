import { type User, getAuth } from "firebase/auth"
import { useEffect, useState } from "react"

interface UseAuthCurrentUserReturn {
  currentUser: User | null
}

export function useAuthCurrentUser(): UseAuthCurrentUserReturn {
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  useEffect(() => {
    const auth = getAuth()
    auth.onAuthStateChanged((user) => {
      if (user) {
        setCurrentUser(user)
      }
    })
  }, [])

  return {
    currentUser: currentUser,
  }
}
