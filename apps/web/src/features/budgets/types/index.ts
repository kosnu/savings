import type { Tables } from "../../../types/database.types"

export type MonthlyBudgetRow = Tables<"monthly_budgets">

export interface MonthlyBudget {
  id: number
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
