import type { Tables } from "../../../types/database.types"

export type MonthlyBudgetRow = Tables<"monthly_budgets">

export interface MonthlyBudget {
  id: number
  bookId: number
  amount: number
  effectiveFrom: Date
  effectiveYear: number
  effectiveMonth: number
  status: "amount"
  createdDate: Date
  updatedDate: Date
}

export type MonthlyBudgetState =
  | { status: "amount"; monthlyBudget: MonthlyBudget }
  | { status: "none"; monthlyBudget: null }
  | { status: "unset"; monthlyBudget: null }
