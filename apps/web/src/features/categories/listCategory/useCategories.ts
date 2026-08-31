import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query"

import type { Category } from "../../../types/category"
import { categoryQueryKeys } from "../queryKeys"
import { fetchCategories } from "./fetchCategories"

interface UseCategoriesReturn {
  data: Category[]
}

const categoriesQueryOptions = queryOptions({
  queryKey: categoryQueryKeys.list,
  queryFn: async () => fetchCategories(),
  // データを無期限に新鮮（fresh）扱いにすることで、同じ queryKey で
  // コンポーネントがマウントしても React Query が自動で再フェッチしません。
  staleTime: Infinity,
  // 不要な自動再フェッチトリガーを無効化します。
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
})

export function useCategories(): UseCategoriesReturn {
  const query = useSuspenseQuery(categoriesQueryOptions)

  return {
    data: query.data,
  }
}

export function usePrefetchCategories(): void {
  useQuery(categoriesQueryOptions)
}
