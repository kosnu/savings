import type { Tables } from "../../../types/database.types"

export type MonthlyBudgetRow = Tables<"monthly_budgets">
export type CategoryBudgetRow = Tables<"category_budgets">

export interface MonthlyBudget {
  id: number
  bookId: number
  amount: number
  effectiveFrom: Date
  effectiveYear: number
  effectiveMonth: number
  userId: number
  createdDate: Date
  updatedDate: Date
}

export interface CategoryBudget {
  id: number
  bookId: number
  categoryId: number
  categoryName: string
  amount: number
  effectiveFrom: Date
  effectiveYear: number
  effectiveMonth: number
  userId: number
  createdDate: Date
  updatedDate: Date
}

export interface TargetMonth {
  year: number
  month: number
}
