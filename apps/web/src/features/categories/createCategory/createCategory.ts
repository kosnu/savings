import { getSupabaseClient } from "../../../lib/supabase"
import { categoryCreateSchema, type CategoryCreateValues } from "./categoryCreateSchema"

export async function createCategory(value: CategoryCreateValues): Promise<number> {
  const supabase = getSupabaseClient()
  const parsedValue = categoryCreateSchema.parse(value)
  const { data, error } = await supabase
    .from("categories")
    .insert({ name: parsedValue.name })
    .select("id")
    .single()

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error("Category was not created.")
  }

  return data.id
}
