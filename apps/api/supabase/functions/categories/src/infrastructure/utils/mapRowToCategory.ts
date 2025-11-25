import { Category, createCategory } from "../../domain/entities/category.ts"
import { createCategoryId } from "../../domain/valueObjects/categoryId.ts"
import { createCategoryName } from "../../domain/valueObjects/categoryName.ts"
import { isErr } from "../../shared/result.ts"
import { CategoryRow } from "../../shared/types.ts"

export function mapRowToCategory(row: CategoryRow): Category {
  const idResult = createCategoryId(BigInt(row.id))
  if (isErr(idResult)) {
    throw new Error(idResult.error.message)
  }

  const nameResult = createCategoryName(row.name)
  if (isErr(nameResult)) {
    throw new Error(nameResult.error.message)
  }

  const createdAt = new Date(row.created_at)
  if (Number.isNaN(createdAt.getTime())) {
    throw new Error("Invalid created_at value received from categories table")
  }

  const updatedAt = new Date(row.updated_at)
  if (Number.isNaN(updatedAt.getTime())) {
    throw new Error("Invalid updated_at value received from categories table")
  }

  const category = createCategory({
    id: idResult.value,
    name: nameResult.value,
    createdAt,
    updatedAt,
  })

  return category
}
