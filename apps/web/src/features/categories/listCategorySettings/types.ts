export interface CategorySettingsBudget {
  id: number
  amount: number
  effectiveFrom: Date
  effectiveYear: number
  effectiveMonth: number
}

export interface CategorySettingsItem {
  category: {
    id: number
    bookId: number
    name: string
  }
  latestCategoryBudget: CategorySettingsBudget | null
  pinned: boolean
}
