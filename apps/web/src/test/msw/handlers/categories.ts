import { HttpResponse, http } from "msw"

import type { CategoryRow } from "../../../types/category"
import { otherBookFoodCat } from "../../data/categories"

const CURRENT_BOOK_ID = 1

const REST_URL = "*/rest/v1/categories*"

const initialCategoryRows: CategoryRow[] = [
  {
    id: 10,
    book_id: 1,
    name: "Food",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  },
  {
    id: 20,
    book_id: 1,
    name: "Daily Necessities",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  },
  {
    id: 30,
    book_id: 1,
    name: "Entertainment",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  },
  {
    id: otherBookFoodCat.id,
    book_id: otherBookFoodCat.bookId,
    name: otherBookFoodCat.name,
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  },
]

interface GetCategoriesHandlerOptions {
  response?: CategoryRow[]
  currentBookId?: number
  error?: boolean
}

export function getCategoriesHandler({
  response = initialCategoryRows,
  currentBookId = CURRENT_BOOK_ID,
  error = false,
}: GetCategoriesHandlerOptions = {}) {
  return http.get(REST_URL, () => {
    if (error) {
      return HttpResponse.json({ message: "Failed to fetch categories." }, { status: 500 })
    }

    return HttpResponse.json(response.filter((row) => row.book_id === currentBookId))
  })
}

interface CreateCategoryHandlersOptions {
  get?: GetCategoriesHandlerOptions
}

export function createCategoryHandlers({ get = {} }: CreateCategoryHandlersOptions = {}) {
  return [getCategoriesHandler(get)]
}

export const categoryHandlers = createCategoryHandlers()
