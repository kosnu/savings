import { useQuery } from "@tanstack/react-query"

import { fetchSelectedBook, type SelectedBook } from "./fetchSelectedBook"
import { selectedBookQueryKeys } from "./selectedBookQueryKeys"

interface UseSelectedBookReturn {
  book: SelectedBook | undefined
  isPending: boolean
  isError: boolean
  promise: Promise<SelectedBook>
}

export function useSelectedBook(authUserId: string | undefined): UseSelectedBookReturn {
  const query = useQuery({
    queryKey: selectedBookQueryKeys.selected(authUserId),
    queryFn: fetchSelectedBook,
    enabled: authUserId !== undefined,
    staleTime: 3000,
  })

  return {
    book: query.data,
    isPending: query.isPending,
    isError: query.isError,
    promise: query.promise,
  }
}
