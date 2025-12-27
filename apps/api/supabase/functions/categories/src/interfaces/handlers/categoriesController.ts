import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../shared/types.ts"
import { getAllCategoriesUseCase } from "../../application/getAllCategoriesUseCase.ts"
import { createSupabaseCategoryRepository } from "../../infrastructure/categoryRepositoryImpl.ts"
import { createErrorResponse, JSON_HEADERS } from "./errorResponse.ts"

export const categoriesController = {
  getAll: async (supabase: SupabaseClient<Database>) => {
    const repo = createSupabaseCategoryRepository({ supabase })
    const result = await getAllCategoriesUseCase(repo)
    if (result.isOk) {
      return new Response(JSON.stringify({ categories: result.value }), {
        status: 200,
        headers: JSON_HEADERS,
      })
    }

    return createErrorResponse(result.error)
  },
}
