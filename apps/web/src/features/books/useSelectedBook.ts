import { queryOptions, useSuspenseQuery } from "@tanstack/react-query"

import { fetchSelectedBook, type SelectedBook } from "./fetchSelectedBook"
import { selectedBookQueryKeys } from "./selectedBookQueryKeys"

interface UseSelectedBookReturn {
  book: SelectedBook
}

export function selectedBookQueryOptions(authUserId: string) {
  return queryOptions({
    queryKey: selectedBookQueryKeys.selected(authUserId),
    queryFn: fetchSelectedBook,
    staleTime: 3000,
  })
}

export function useSelectedBook(authUserId: string): UseSelectedBookReturn {
  const query = useSuspenseQuery(selectedBookQueryOptions(authUserId))
  return {
    book: query.data,
  }
}
