import type { CategoryBudgetUpdateStatus } from "../categoryBudget"

export interface CategoryNameUpdateInput {
  categoryId: number
  name: string
  pinned: boolean
  budgetStatus: CategoryBudgetUpdateStatus
  budgetAmount: number | null
}
