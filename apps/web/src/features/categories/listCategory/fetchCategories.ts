import { getSupabaseClient } from "../../../lib/supabase"
import type { Category, CategoryRow } from "../../../types/category"

function toCategoryFromRow(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    createdDate: row.created_at ? new Date(row.created_at) : new Date(),
    updatedDate: row.updated_at ? new Date(row.updated_at) : new Date(),
  }
}

export async function fetchCategories(): Promise<Category[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from("categories").select("*")

  if (error) {
    throw error
  }

  return data.map(toCategoryFromRow)
}
