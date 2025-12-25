import type { SupabaseClient } from "@supabase/supabase-js"
import { Category } from "../domain/entities/category.ts"
import { CategoryRepository } from "../domain/repository.ts"
import { Database } from "../shared/types.ts"
import { mapRowToCategory } from "./utils/mapRowToCategory.ts"
import { DomainError, unexpectedError } from "../shared/errors.ts"
import { err, ok, Result } from "../shared/result.ts"

type CreateCategoryRepositoryParams = {
  fetchCategories: () => Promise<Result<ReadonlyArray<Category>, DomainError>>
}

const createFetchCategories = (
  supabase: SupabaseClient<Database>,
) =>
async (): Promise<Result<ReadonlyArray<Category>, DomainError>> => {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, created_at, updated_at")
    .order("id", { ascending: true })

  if (error) {
    return err(unexpectedError("Failed to fetch categories", error))
  }

  const rows = data ?? []
  try {
    const categories = rows.map(mapRowToCategory)
    return ok(categories)
  } catch (e) {
    return err(unexpectedError("Failed to map category rows", e as Error))
  }
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
