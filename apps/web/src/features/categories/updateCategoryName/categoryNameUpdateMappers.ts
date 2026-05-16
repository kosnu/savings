import type { TablesUpdate } from "../../../types/database.types"

export interface CategoryNameUpdateInput {
  categoryId: number
  name: string
}

export type CategoryNameUpdate = Pick<TablesUpdate<"categories">, "name">

export function toCategoryNameUpdate(value: CategoryNameUpdateInput): CategoryNameUpdate {
  return {
    name: value.name,
  }
}
