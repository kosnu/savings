import * as z from "zod"

import type { MonthlyBudget } from "./types"
import { parseIsoDateOnlyToLocalDate } from "./utils/month"

const monthlyBudgetRowSchema = z.object({
  id: z.number(),
  amount: z.number(),
  effective_from: z.string(),
  effective_year: z.number(),
  effective_month: z.number(),
  user_id: z.number(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
})

type NormalizedMonthlyBudgetRow = z.infer<typeof monthlyBudgetRowSchema>

export function normalizeMonthlyBudgetRow(value: unknown): NormalizedMonthlyBudgetRow {
  const result = monthlyBudgetRowSchema.safeParse(value)

  if (!result.success) {
    throw new Error("Invalid monthly budget response")
  }

  return result.data
}

export function normalizeMonthlyBudgetRows(value: unknown): NormalizedMonthlyBudgetRow[] {
  const result = z.array(monthlyBudgetRowSchema).safeParse(value)

  if (!result.success) {
    throw new Error("Invalid monthly budget response")
  }

  return result.data
}

export function toMonthlyBudget(row: NormalizedMonthlyBudgetRow): MonthlyBudget {
  return {
    id: row.id,
    amount: row.amount,
    effectiveFrom: parseIsoDateOnlyToLocalDate(row.effective_from),
    effectiveYear: row.effective_year,
    effectiveMonth: row.effective_month,
    userId: row.user_id,
    createdDate: row.created_at ? new Date(row.created_at) : new Date(),
    updatedDate: row.updated_at ? new Date(row.updated_at) : new Date(),
  }
}
