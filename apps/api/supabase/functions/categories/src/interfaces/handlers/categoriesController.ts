import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../shared/types.ts"
import type { CategoryRepository } from "../../domain/repository.ts"
import { getAllCategoriesUseCase } from "../../application/getAllCategoriesUseCase.ts"
import { createSupabaseCategoryRepository } from "../../infrastructure/categoryRepositoryImpl.ts"
import { createErrorResponse, JSON_HEADERS } from "./errorResponse.ts"

type CategoriesControllerDeps = {
  createRepository: (
    params: { supabase: SupabaseClient<Database> },
  ) => CategoryRepository
  getAllUseCase: typeof getAllCategoriesUseCase
  createErrorResponse: typeof createErrorResponse
  jsonHeaders: HeadersInit
}

export const createCategoriesController = (
  deps: CategoriesControllerDeps,
) => {
  const getAll = async (supabase: SupabaseClient<Database>) => {
    const repo = deps.createRepository({ supabase })
    const result = await deps.getAllUseCase(repo)
    if (result.isOk) {
      return new Response(JSON.stringify({ categories: result.value }), {
        status: 200,
        headers: deps.jsonHeaders,
      })
    }

    return deps.createErrorResponse(result.error)
  }

  return { getAll }
}

export const categoriesController = createCategoriesController({
  createRepository: createSupabaseCategoryRepository,
  getAllUseCase: getAllCategoriesUseCase,
  createErrorResponse,
  jsonHeaders: JSON_HEADERS,
})
