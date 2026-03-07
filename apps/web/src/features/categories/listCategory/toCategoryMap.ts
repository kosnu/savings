import type { Category } from "../../../types/category"
import { unknownCategory } from "../unknownCategory"

export function toCategoryMap(categories: Category[]): Map<number, Category> {
  return categories.reduce((acc, category) => {
    if (category.id > 0) {
      acc.set(category.id, category)
    }
    return acc
  }, new Map<number, Category>())
}

export function getCategoryStrict(
  map: Map<number, Category>,
  id: number | null,
): Category {
  if (id === null) return unknownCategory
  const category = map.get(id) ?? unknownCategory

  return category
}
