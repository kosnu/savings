import { QueryClient } from "@tanstack/react-query"

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Project-wide sensible defaults. Adjust as needed.
        staleTime: 1000 * 60, // 1 minute
        retry: 1,
        refetchOnWindowFocus: false,
        experimental_prefetchInRender: true,
      },
    },
  })
}

export default createQueryClient
