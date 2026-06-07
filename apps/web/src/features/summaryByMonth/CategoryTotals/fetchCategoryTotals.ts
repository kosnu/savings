import * as z from "zod"

import { toDateOnlyString } from "../../../domain/date"
import { getSupabaseClient } from "../../../lib/supabase"
import {
  categoryBudgetResponseSchema,
  type CategoryBudgetState,
} from "../../categories/categoryBudget"

const categoryTotalsRowSchema = z
  .object({
    category_id: z.number().nullable(),
    category_name: z.string(),
    total_amount: z.number(),
    pinned: z.boolean(),
    kind: z.enum(["category", "uncategorized"]),
  })
  .merge(categoryBudgetResponseSchema)

type CategoryTotalsRow = z.infer<typeof categoryTotalsRowSchema>

export interface CategoryTotal {
  key: string
  categoryId: number | null
  categoryName: string
  totalAmount: number
  pinned: boolean
  budgetState: CategoryBudgetState
  budgetAmount: number | null
  kind: "category" | "uncategorized"
}

export type CategoryTotals = CategoryTotal[]

export async function fetchCategoryTotals([startDate, endDate]: [
  Date | null,
  Date | null,
]): Promise<CategoryTotals> {
  const supabase = getSupabaseClient()
  const formattedStartDate = toDateOnlyString(startDate ?? new Date())
  const formattedEndDate = toDateOnlyString(endDate ?? startDate ?? new Date())
  const { data, error } = await supabase.rpc("get_category_totals_with_budgets", {
    p_end_date: formattedEndDate,
    p_start_date: formattedStartDate,
  })

  if (error) {
    throw error
  }

  return normalizeCategoryTotalsRows(data ?? []).map(toCategoryTotal)
}

function normalizeCategoryTotalsRows(value: unknown): CategoryTotalsRow[] {
  const result = z.array(categoryTotalsRowSchema).safeParse(value)

  if (!result.success) {
    throw new Error("Invalid category totals response")
  }

  return result.data
}

function toCategoryTotal(row: CategoryTotalsRow): CategoryTotal {
  return {
    key: row.kind === "category" ? `category:${row.category_id}` : "uncategorized",
    categoryId: row.category_id,
    categoryName: row.category_name,
    totalAmount: row.total_amount,
    pinned: row.pinned,
    budgetState: row.budget_state,
    budgetAmount: row.budget_amount,
    kind: row.kind,
  }
}
