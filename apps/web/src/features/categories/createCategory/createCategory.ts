import { getSupabaseClient } from "../../../lib/supabase"
import { categoryCreateSchema, type CategoryCreateValues } from "./categoryCreateSchema"

export async function createCategory(value: CategoryCreateValues): Promise<number> {
  const supabase = getSupabaseClient()
  const parsedValue = categoryCreateSchema.parse(value)
  const { data, error } = await supabase.rpc("create_category_with_pin", {
    p_category_name: parsedValue.name,
    p_pinned: parsedValue.pinned,
  })

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error("Category was not created.")
  }

  return data
}
