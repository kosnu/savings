import { useQuery } from "@tanstack/react-query"

import { currentBookQueryKeys } from "./currentBookQueryKeys"
import { fetchCurrentBook, type CurrentBook } from "./fetchCurrentBook"

interface UseCurrentBookReturn {
  book: CurrentBook | undefined
  isPending: boolean
  isError: boolean
  promise: Promise<CurrentBook>
}

export function useCurrentBook(authUserId: string): UseCurrentBookReturn {
  const query = useQuery({
    queryKey: currentBookQueryKeys.current(authUserId),
    queryFn: fetchCurrentBook,
    staleTime: 3000,
  })

  return {
    book: query.data,
    isPending: query.isPending,
    isError: query.isError,
    promise: query.promise,
  }
}
