import { type DelayMode, HttpResponse, delay, http } from "msw"

const BOOK_MEMBERS_REST_URL = "*/rest/v1/book_members*"

export interface CurrentBookResponse {
  book_id: number
  is_default: true
  books: {
    id: number
    name: string
  }
}

interface CurrentBookOptions {
  response?: CurrentBookResponse
  error?: boolean
  durationOrMode?: number | DelayMode | undefined
}

export function createBookHandlers({
  response = {
    book_id: 1,
    is_default: true,
    books: {
      id: 1,
      name: "Default Book",
    },
  },
  error = false,
  durationOrMode,
}: CurrentBookOptions = {}) {
  return [
    http.get(BOOK_MEMBERS_REST_URL, async () => {
      await delay(durationOrMode)

      if (error) {
        return HttpResponse.json({ message: "Failed to fetch current book." }, { status: 500 })
      }

      return HttpResponse.json(response)
    }),
  ]
}

export const bookHandlers = createBookHandlers()
