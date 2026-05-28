import * as z from "zod"

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
  const { data, error } = await supabase
    .from("categories")
    .select(categorySettingsColumns)
    .order("id", { ascending: true })
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
  return {
    category: {
      id: row.id,
      bookId: row.book_id,
      name: row.name,
    },
    pinned: (row.category_pins ?? []).some((pin) => pin.category_id === row.id),
  }
}
