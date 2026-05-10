import * as z from "zod"

import { getSupabaseClient } from "../../../lib/supabase"
import { parseIsoDateOnlyToLocalDate } from "../../budgets/utils/month"
import type { CategorySettingsBudget, CategorySettingsItem } from "./types"

const categorySettingsColumns = `
  id,
  book_id,
  name,
  category_budgets:category_budgets!category_budgets_category_id_fkey (
    id,
    amount,
    effective_from,
    effective_year,
    effective_month
  ),
  category_pins:category_pins!category_pins_category_id_fkey (
    id,
    category_id
  )
`

const categorySettingsBudgetRowSchema = z.object({
  id: z.number(),
  amount: z.number(),
  effective_from: z.string(),
  effective_year: z.number(),
  effective_month: z.number(),
})

const categoryPinRowSchema = z.object({
  id: z.number(),
  category_id: z.number(),
})

const categorySettingsRowSchema = z.object({
  id: z.number(),
  book_id: z.number(),
  name: z.string(),
  category_budgets: z.array(categorySettingsBudgetRowSchema).nullable(),
  category_pins: z.array(categoryPinRowSchema).nullable(),
})

type CategorySettingsRow = z.infer<typeof categorySettingsRowSchema>
type CategorySettingsBudgetRow = z.infer<typeof categorySettingsBudgetRowSchema>

export async function fetchCategorySettingsItems(): Promise<CategorySettingsItem[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("categories")
    .select(categorySettingsColumns)
    .order("id", { ascending: true })
    .order("effective_from", { referencedTable: "category_budgets", ascending: false })
    .order("id", { referencedTable: "category_budgets", ascending: false })
    .limit(1, { referencedTable: "category_budgets" })
    .limit(1, { referencedTable: "category_pins" })

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
  const latestBudget = row.category_budgets?.[0] ?? null

  return {
    category: {
      id: row.id,
      bookId: row.book_id,
      name: row.name,
    },
    latestCategoryBudget: latestBudget ? toCategorySettingsBudget(latestBudget) : null,
    pinned: (row.category_pins ?? []).some((pin) => pin.category_id === row.id),
  }
}

function toCategorySettingsBudget(row: CategorySettingsBudgetRow): CategorySettingsBudget {
  return {
    id: row.id,
    amount: row.amount,
    effectiveFrom: parseIsoDateOnlyToLocalDate(row.effective_from),
    effectiveYear: row.effective_year,
    effectiveMonth: row.effective_month,
  }
}
