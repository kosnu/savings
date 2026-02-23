import { apiClient, buildFunctionUrl } from "../../../lib/apiClient"
import type { Category } from "../../../types/category"

interface CategoryDto {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

interface CategoriesResponse {
  categories: CategoryDto[]
}

export async function fetchCategories(): Promise<Category[]> {
  const url = buildFunctionUrl("categories")
  const response = await apiClient.get<CategoriesResponse>(url)
  return response.categories.map((dto) => ({
    id: dto.id,
    name: dto.name,
    createdDate: new Date(dto.createdAt),
    updatedDate: new Date(dto.updatedAt),
  }))
}
