import { useQuery } from "@tanstack/react-query"

import type { CategoryBudget } from "../types"
import { fetchCategoryBudgets } from "./fetchCategoryBudgets"

interface UseCategoryBudgetsReturn {
  data: CategoryBudget[]
  loading: boolean
  error: Error | null
  promise: Promise<CategoryBudget[]>
}

export function useCategoryBudgets(): UseCategoryBudgetsReturn {
  const query = useQuery({
    queryKey: ["categoryBudgets"],
    queryFn: async () => fetchCategoryBudgets(),
    staleTime: 3000, // 3秒
  })

  return {
    data: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    promise: query.promise,
  }
}
