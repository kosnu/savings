import { Category } from "../domain/entities/category.ts"

export interface CategoryDto {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export function convertCategoryToDto(category: Category): CategoryDto {
  return {
    id: category.id.value.toString(),
    name: category.name.value,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  }
}
