import { CategoryId } from "../valueObjects/categoryId.ts"
import { CategoryName } from "../valueObjects/categoryName.ts"

export type Category = {
  id: CategoryId
  name: CategoryName
  createdAt: Date
  updatedAt: Date
}

export function createCategory(params: {
  id: CategoryId
  name: CategoryName
  createdAt: Date
  updatedAt: Date
}): Category {
  return {
    id: params.id,
    name: params.name,
    createdAt: params.createdAt,
    updatedAt: params.updatedAt,
  }
}
