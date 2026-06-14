export interface CategorySettingsItem {
  category: {
    id: number
    bookId: number
    name: string
  }
  pinned: boolean
  budgetStatus: "amount" | "none" | "unset"
  budgetAmount: number | null
}
