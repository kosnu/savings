import { QueryCache, QueryClient } from "@tanstack/react-query"

// PostgREST の JWT 関連エラーは PGRST3xx コードで返される
// instanceof ではなく構造チェックを使い、プレーンオブジェクトでも動作するようにする
function isPostgrestUnauthorized(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    (error as { code: string }).code.startsWith("PGRST3")
  )
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
