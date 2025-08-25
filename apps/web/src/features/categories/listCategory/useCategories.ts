import { useCallback, useMemo } from "react"
import { useFirestore } from "../../../providers/firebase/useFirestore"
import type { Category } from "../../../types/category"
import { fetchCategories } from "./fetchCategories"

interface UseCategoriesReturn {
  getCategories: () => Promise<Category[]>
  promiseCategories: Promise<Category[]>
}

export function useCategories(): UseCategoriesReturn {
  const db = useFirestore()

  const getCategories = useCallback(async (): Promise<Category[]> => {
    return await fetchCategories(db)
  }, [db])

  const categories = useMemo(() => getCategories(), [getCategories])

  return {
    getCategories: getCategories,
    promiseCategories: categories,
  }
}
