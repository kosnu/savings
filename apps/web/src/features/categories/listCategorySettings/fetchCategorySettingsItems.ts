import * as z from "zod"

import { getSupabaseClient } from "../../../lib/supabase"
import { categoryBudgetResponseSchema } from "../categoryBudget"
import type { CategorySettingsItem } from "./types"

const categorySettingsRowSchema = z
  .object({
    id: z.number(),
    book_id: z.number(),
    name: z.string(),
    pinned: z.boolean(),
  })
  .merge(categoryBudgetResponseSchema)

type CategorySettingsRow = z.infer<typeof categorySettingsRowSchema>

export async function fetchCategorySettingsItems(): Promise<CategorySettingsItem[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc("list_category_settings_items")

  if (error) {
    throw error
  }

  return normalizeCategorySettingsRows(data ?? []).map(toCategorySettingsItem)
}

function normalizeCategorySettingsRows(value: unknown): CategorySettingsRow[] {
  const result = z.array(categorySettingsRowSchema).safeParse(value)

  if (!result.success) {
    throw new Error("Invalid category settings response")
  }

  return result.data
}

function toCategorySettingsItem(row: CategorySettingsRow): CategorySettingsItem {
  return {
    category: {
      id: row.id,
      bookId: row.book_id,
      name: row.name,
      budget: {
        state: row.budget_state,
        amount: row.budget_amount,
      },
    },
    pinned: row.pinned,
  }
}
