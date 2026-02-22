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
    id: "VgtuFszVjxOlwM040cyf",
    name: "Food",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
  {
    id: "eq1duDRDUKJTFZac1Ztp",
    name: "Daily Necessities",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
  {
    id: "Pdgee5Sp6vhRanU3gEv0",
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
