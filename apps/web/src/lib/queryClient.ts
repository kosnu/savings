import { QueryClient } from "@tanstack/react-query"
import { isUnauthorizedError } from "./apiErrors"

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Project-wide sensible defaults. Adjust as needed.
        staleTime: 1000 * 60, // 1 minute
        retry: (failureCount, error) => {
          if (isUnauthorizedError(error)) return false
          return failureCount < 1
        },
        refetchOnWindowFocus: false,
        experimental_prefetchInRender: true,
      },
    },
  })
}

export default createQueryClient
