import { getSupabaseClient } from "../../../lib/supabase"

export async function deleteCategory(categoryId: number): Promise<void> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("categories")
    .delete()
    .eq("id", categoryId)
    .select("id")
    .single()

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error("Category was not deleted.")
  }
}
