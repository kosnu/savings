import { getSupabaseClient } from "../../../lib/supabase"

export interface CategoryPinUpdateInput {
  categoryId: number
  pinned: boolean
}

export async function updateCategoryPin({
  categoryId,
  pinned,
}: CategoryPinUpdateInput): Promise<void> {
  const supabase = getSupabaseClient()

  if (pinned) {
    const { data, error } = await supabase
      .from("category_pins")
      .insert({ category_id: categoryId })
      .select("id")
      .single()

    if (error) {
      throw error
    }

    if (!data) {
      throw new Error("Category pin was not created.")
    }

    return
  }

  const { error } = await supabase
    .from("category_pins")
    .delete()
    .eq("category_id", categoryId)
    .select("id")

  if (error) {
    throw error
  }
}
