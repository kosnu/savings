import { useSuspenseQuery } from "@tanstack/react-query"

import { fetchSelectedBook, type SelectedBook } from "./fetchSelectedBook"
import { selectedBookQueryKeys } from "./selectedBookQueryKeys"

interface UseSelectedBookReturn {
  book: SelectedBook
}

export function useSelectedBook(authUserId: string): UseSelectedBookReturn {
  const query = useSuspenseQuery({
    queryKey: selectedBookQueryKeys.selected(authUserId),
    queryFn: fetchSelectedBook,
    staleTime: 3000,
  })

  return {
    book: query.data,
  }
}
