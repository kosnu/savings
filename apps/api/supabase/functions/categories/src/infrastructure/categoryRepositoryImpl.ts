import type { SupabaseClient } from "@supabase/supabase-js"
import { Category } from "../domain/entities/category.ts"
import { CategoryRepository } from "../domain/repository.ts"
import { Database } from "../shared/types.ts"
import { mapRowToCategory } from "./utils/mapRowToCategory.ts"

type CreateCategoryRepositoryParams = {
  fetchCategories: () => Promise<ReadonlyArray<Category>>
}

const createFetchCategories = (
  supabase: SupabaseClient<Database>,
) =>
async (): Promise<ReadonlyArray<Category>> => {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, created_at, updated_at")
    .order("id", { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch categories: ${error.message}`)
  }

  const rows = data ?? []
  return rows.map(mapRowToCategory)
}

const createCategoryRepository = (
  { fetchCategories }: CreateCategoryRepositoryParams,
): CategoryRepository => {
  const findAll: CategoryRepository["findAll"] = () => fetchCategories()

  return {
    findAll,
  }
}

type CreateSupabaseCategoryRepositoryParams = {
  supabase: SupabaseClient<Database>
}

export const createSupabaseCategoryRepository = (
  { supabase }: CreateSupabaseCategoryRepositoryParams,
): CategoryRepository =>
  createCategoryRepository({
    fetchCategories: createFetchCategories(supabase),
  })
