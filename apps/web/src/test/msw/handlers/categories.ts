import { HttpResponse, http } from "msw"

import type { CategoryRow } from "../../../types/category"

const REST_URL = "*/rest/v1/categories*"

const categoryRows: CategoryRow[] = [
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

export const categoryHandlers = [
  http.get(REST_URL, () => {
    return HttpResponse.json(categoryRows)
  }),
]
