import * as z from "zod"

export type CategoryBudgetState = "amount" | "none" | "unset"
export type CategoryBudgetUpdateStatus = "amount" | "none" | "unchanged"

export interface CategoryBudget {
  state: CategoryBudgetState
  amount: number | null
}

export const categoryBudgetInputSchema = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => value === "" || /^\d+$/.test(value), "Budget must be a whole number")
  .transform((value) => (value === "" ? null : Number(value)))

export const categoryBudgetResponseSchema = z.object({
  budget_state: z.enum(["amount", "none", "unset"]),
  budget_amount: z.number().nullable(),
})

export function toCategoryBudgetInput(budget: CategoryBudget): string {
  return budget.state === "amount" && budget.amount !== null ? String(budget.amount) : ""
}
