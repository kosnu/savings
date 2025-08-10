import { useCallback } from "react"
import type { Category } from "../../../../types/category"
import { useAuthCurrentUser } from "../../../../utils/auth/useAuthCurrentUser"
import { useFirestore } from "../../../../utils/firebase/useFirestore"
import { fetchCategories } from "./fetchCategories"

interface UseGetCategoriesReturn {
  getCategories: () => Promise<Category[]>
}

export function useGetCategories(): UseGetCategoriesReturn {
  const { currentUser } = useAuthCurrentUser()
  const db = useFirestore()

  const getCategories = useCallback(async (): Promise<Category[]> => {
    return await fetchCategories(db, currentUser)
  }, [db, currentUser])

  return {
    getCategories: getCategories,
  }
}
