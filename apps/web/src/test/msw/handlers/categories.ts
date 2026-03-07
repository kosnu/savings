import { HttpResponse, http } from "msw"

const BASE_URL = "*/functions/v1/categories"

export interface CategoryDto {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

const categoryDtos: CategoryDto[] = [
  {
    id: "10",
    name: "Food",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
  {
    id: "20",
    name: "Daily Necessities",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
  {
    id: "30",
    name: "Entertainment",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
]

export const categoryHandlers = [
  http.get(BASE_URL, () => {
    return HttpResponse.json({ categories: categoryDtos })
  }),
]
