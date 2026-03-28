import { HttpResponse, http } from "msw"

import type { CategoryRow } from "../../../types/category"

const REST_URL = "*/rest/v1/categories*"

const initialCategoryRows: CategoryRow[] = [
  {
    id: 10,
    name: "Food",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  },
  {
    id: 20,
    name: "Daily Necessities",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  },
  {
    id: 30,
    name: "Entertainment",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  },
]

interface GetCategoriesHandlerOptions {
  response?: CategoryRow[]
  error?: boolean
}

export function getCategoriesHandler({
  response = initialCategoryRows,
  error = false,
}: GetCategoriesHandlerOptions = {}) {
  return http.get(REST_URL, () => {
    if (error) {
      return HttpResponse.json({ message: "Failed to fetch categories." }, { status: 500 })
    }

    return HttpResponse.json(response)
  })
}

interface CreateCategoryHandlersOptions {
  get?: GetCategoriesHandlerOptions
}

export function createCategoryHandlers({ get = {} }: CreateCategoryHandlersOptions = {}) {
  return [getCategoriesHandler(get)]
}

export const categoryHandlers = createCategoryHandlers()
