import { useQuery } from "@tanstack/react-query"

import { currentBookQueryKeys } from "./currentBookQueryKeys"
import { fetchCurrentBook, type CurrentBook } from "./fetchCurrentBook"

interface UseCurrentBookReturn {
  promise: Promise<CurrentBook>
}

export function useCurrentBook(authUserId: string): UseCurrentBookReturn {
  const query = useQuery({
    queryKey: currentBookQueryKeys.current(authUserId),
    queryFn: fetchCurrentBook,
    staleTime: 3000,
  })

  return { promise: query.promise }
}
