import { getSupabaseClient } from "../../../lib/supabase"
import { type CategoryNameUpdateInput, toCategoryNameUpdate } from "./categoryNameUpdateMappers"

export async function updateCategoryName(value: CategoryNameUpdateInput): Promise<void> {
  const supabase = getSupabaseClient()
  const payload = toCategoryNameUpdate(value)
  const { data, error } = await supabase
    .from("categories")
    .update(payload)
    .eq("id", value.categoryId)
    .select("id")
    .single()

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error("Category was not updated.")
  }
}
