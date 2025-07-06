import type { Category } from "../../../types/category"


export function toCategoryMap(categories: Category[]): Map<string, Category> {
  return categories.reduce((acc, category) => {
    if (category.id) {
      acc.set(category.id, category)
    }
    return acc
  }, new Map<string, Category>())
}

export function getCategoryStrict(map: Map<string, Category>, id: string): Category {
  const category = map.get(id) ?? unknownCategory

  return category
}

const unknownCategory: Category = {
  id: "unknown",
  userId: "unknown",
  name: "Unknown category",
  createdDate: new Date(),
  updatedDate: new Date(),
}
