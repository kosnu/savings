import { useQuery } from "@tanstack/react-query"
import { useFirestore } from "../../../providers/firebase/useFirestore"
import type { Category } from "../../../types/category"
import { fetchCategories } from "./fetchCategories"

interface UseCategoriesReturn {
  data: Category[]
  loading: boolean
  promise: Promise<Category[]>
  error: Error | null
}

export function useCategories(): UseCategoriesReturn {
  const db = useFirestore()
  const query = useQuery({
    queryKey: ["categories"],
    queryFn: () => fetchCategories(db),
    // データを無期限に新鮮（fresh）扱いにすることで、同じ queryKey で
    // コンポーネントがマウントしても React Query が自動で再フェッチしません。
    staleTime: Infinity,
    // 不要な自動再フェッチトリガーを無効化します。
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  return {
    data: query.data ?? [],
    loading: query.isLoading,
    promise: query.promise,
    error: query.error,
  }
}
