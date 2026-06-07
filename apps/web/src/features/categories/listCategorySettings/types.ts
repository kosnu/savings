import type { CategoryBudget } from "../categoryBudget"

export interface CategorySettingsItem {
  category: {
    id: number
    bookId: number
    name: string
    budget: CategoryBudget
  }
  pinned: boolean
}
