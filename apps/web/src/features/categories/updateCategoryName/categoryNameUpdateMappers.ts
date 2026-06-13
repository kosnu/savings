export interface CategoryNameUpdateInput {
  categoryId: number
  name: string
  pinned: boolean
  budgetAmount: number | null
  budgetAction: "keep" | "set" | "unset"
}
