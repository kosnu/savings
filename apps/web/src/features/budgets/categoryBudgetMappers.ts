import * as z from "zod"

import type { CategoryBudget } from "./types"
import { parseIsoDateOnlyToLocalDate } from "./utils/month"

const categoryBudgetRowSchema = z.object({
  id: z.number(),
  book_id: z.number(),
  category_id: z.number(),
  amount: z.number(),
  effective_from: z.string(),
  effective_year: z.number(),
  effective_month: z.number(),
  user_id: z.number(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  category: z.object({
    id: z.number(),
    name: z.string(),
  }),
})

type NormalizedCategoryBudgetRow = z.infer<typeof categoryBudgetRowSchema>

export function normalizeCategoryBudgetRows(value: unknown): NormalizedCategoryBudgetRow[] {
  const result = z.array(categoryBudgetRowSchema).safeParse(value)

  if (!result.success) {
    throw new Error("Invalid category budget response")
  }

  return result.data
}

export function toCategoryBudget(row: NormalizedCategoryBudgetRow): CategoryBudget {
  return {
    id: row.id,
    bookId: row.book_id,
    categoryId: row.category_id,
    categoryName: row.category.name,
    amount: row.amount,
    effectiveFrom: parseIsoDateOnlyToLocalDate(row.effective_from),
    effectiveYear: row.effective_year,
    effectiveMonth: row.effective_month,
    userId: row.user_id,
    createdDate: row.created_at ? new Date(row.created_at) : new Date(),
    updatedDate: row.updated_at ? new Date(row.updated_at) : new Date(),
  }
}

export function pickLatestCategoryBudgetRows(
  rows: NormalizedCategoryBudgetRow[],
): NormalizedCategoryBudgetRow[] {
  const latestRows = new Map<number, NormalizedCategoryBudgetRow>()

  for (const row of rows) {
    const current = latestRows.get(row.category_id)

    if (!current || isNewerCategoryBudgetRow(row, current)) {
      latestRows.set(row.category_id, row)
    }
  }

  return Array.from(latestRows.values())
}

function isNewerCategoryBudgetRow(
  candidate: NormalizedCategoryBudgetRow,
  current: NormalizedCategoryBudgetRow,
): boolean {
  if (candidate.effective_from !== current.effective_from) {
    return candidate.effective_from > current.effective_from
  }

  return candidate.id > current.id
}
