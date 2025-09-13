import type { Category } from "../../../types/category"
import { unknownCategory } from "../unknownCategory"

export function toCategoryMap(categories: Category[]): Map<string, Category> {
  return categories.reduce((acc, category) => {
    if (category.id) {
      acc.set(category.id, category)
    }
    return acc
  }, new Map<string, Category>())
}

export function getCategoryStrict(
  map: Map<string, Category>,
  id: Category["id"],
): Category {
  const category = map.get(id) ?? unknownCategory

  return category
}
