import { PostgrestError } from "@supabase/supabase-js"
import { QueryCache, QueryClient } from "@tanstack/react-query"

// PostgREST の JWT 関連エラーは PGRST3xx コードで返される
function isPostgrestUnauthorized(error: unknown): boolean {
  return error instanceof PostgrestError && error.code.startsWith("PGRST3")
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60,
        retry: (failureCount, error) => {
          if (isPostgrestUnauthorized(error)) return false
          return failureCount < 1
        },
        refetchOnWindowFocus: false,
        experimental_prefetchInRender: true,
      },
    },
    queryCache: new QueryCache({
      onError: (error) => {
        if (isPostgrestUnauthorized(error)) {
          if (typeof window !== "undefined") {
            window.location.href = "/"
          }
        }
      },
    }),
  })
}

export default createQueryClient
