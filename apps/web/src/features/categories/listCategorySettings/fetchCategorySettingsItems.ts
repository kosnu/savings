import * as z from "zod"

import { toCategoryBudgetMap, type CategoryBudgetState } from "../../../domain/categoryBudget"
import { toDateOnlyString } from "../../../domain/date"
import { getSupabaseClient } from "../../../lib/supabase"
import type { CategorySettingsItem } from "./types"

const categorySettingsColumns = `
  id,
  book_id,
  name,
  category_pins:category_pins!category_pins_category_id_fkey (
    id,
    category_id
  )
`

const categoryPinRowSchema = z.object({
  id: z.number(),
  category_id: z.number(),
})

const categorySettingsRowSchema = z.object({
  id: z.number(),
  book_id: z.number(),
  name: z.string(),
  category_pins: z.array(categoryPinRowSchema).nullable(),
})

type CategorySettingsRow = z.infer<typeof categorySettingsRowSchema>

export async function fetchCategorySettingsItems(): Promise<CategorySettingsItem[]> {
  const supabase = getSupabaseClient()
  const categorySettingsQuery = supabase
    .from("categories")
    .select(categorySettingsColumns)
    .order("id", { ascending: true })
    .limit(1, { referencedTable: "category_pins" })

  const categoryBudgetsQuery = supabase.rpc("get_effective_category_budgets", {
    p_target_month: toDateOnlyString(new Date()),
  })

  const [categorySettingsResponse, categoryBudgetsResponse] = await Promise.all([
    categorySettingsQuery,
    categoryBudgetsQuery,
  ])

  const { data, error } = categorySettingsResponse

  if (error) {
    throw error
  }

  if (categoryBudgetsResponse.error) {
    throw categoryBudgetsResponse.error
  }

  const categoryBudgetMap = toCategoryBudgetMap(categoryBudgetsResponse.data)

  return normalizeCategorySettingsRows(data ?? []).map((row) =>
    toCategorySettingsItem(row, categoryBudgetMap),
  )
}

function normalizeCategorySettingsRows(value: unknown): CategorySettingsRow[] {
  const result = z.array(categorySettingsRowSchema).safeParse(value)

  if (!result.success) {
    throw new Error("Invalid category settings response")
  }

  return result.data
}

function toCategorySettingsItem(
  row: CategorySettingsRow,
  categoryBudgetMap: Map<number, CategoryBudgetState>,
): CategorySettingsItem {
  const budgetState = categoryBudgetMap.get(row.id) ?? { status: "unset", amount: null }

  return {
    category: {
      id: row.id,
      bookId: row.book_id,
      name: row.name,
    },
    pinned: (row.category_pins ?? []).some((pin) => pin.category_id === row.id),
    budgetStatus: budgetState.status,
    budgetAmount: budgetState.amount,
  }
}
