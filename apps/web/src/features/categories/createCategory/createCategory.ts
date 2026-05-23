import { getSupabaseClient } from "../../../lib/supabase"
import {
  mapCategoryCreateValuesToCategoryCreateInput,
  toCategoryCreateRpcArgs,
} from "./categoryCreateMappers"
import { categoryCreateSchema, type CategoryCreateValues } from "./categoryCreateSchema"

export async function createCategory(value: CategoryCreateValues): Promise<number> {
  const supabase = getSupabaseClient()
  const parsedValue = categoryCreateSchema.parse(value)
  const input = mapCategoryCreateValuesToCategoryCreateInput(parsedValue)
  const { data, error } = await supabase.rpc(
    "create_category_with_budget",
    toCategoryCreateRpcArgs(input),
  )

  if (error) {
    throw error
  }

  if (data === null) {
    throw new Error("Category was not created.")
  }

  return data
}
