import { useCallback, useMemo } from "react"
import { useFirestore } from "../../../providers/firebase/useFirestore"
import type { Category } from "../../../types/category"
import { useAuthCurrentUser } from "../../../utils/auth/useAuthCurrentUser"
import { fetchCategories } from "./fetchCategories"

interface UseCategoriesReturn {
  getCategories: () => Promise<Category[]>
  promiseCategories: Promise<Category[]>
}

export function useCategories(): UseCategoriesReturn {
  const { currentUser } = useAuthCurrentUser()
  const db = useFirestore()

  const getCategories = useCallback(async (): Promise<Category[]> => {
    return await fetchCategories(db, currentUser)
  }, [db, currentUser])

  const categories = useMemo(() => getCategories(), [getCategories])

  return {
    getCategories: getCategories,
    promiseCategories: categories,
  }
}
