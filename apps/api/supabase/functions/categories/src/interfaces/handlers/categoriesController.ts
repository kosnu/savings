import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../shared/types.ts"
import { getAllCategoriesUseCase } from "../../application/getAllCategoriesUseCase.ts"
import { createSupabaseCategoryRepository } from "../../infrastructure/categoryRepositoryImpl.ts"

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" }

export const categoriesController = {
  getAll: async (supabase: SupabaseClient<Database>) => {
    const repo = createSupabaseCategoryRepository({ supabase })

    try {
      const categories = await getAllCategoriesUseCase(repo)
      return new Response(JSON.stringify({ categories }), {
        status: 200,
        headers: JSON_HEADERS,
      })
    } catch (error) {
      if (isPostgrestError(error)) {
        // PostgrestError は message, details, hint, code などを持ちます（null あり）
        return new Response(
          JSON.stringify({
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          }),
          {
            headers: JSON_HEADERS,
            status: 500,
          },
        )
      }

      if (error instanceof Error) {
        return new Response(JSON.stringify({ message: error.message }), {
          headers: JSON_HEADERS,
          status: 500,
        })
      }
    }
  },
}

function isPostgrestError(err: unknown): err is PostgrestError {
  return typeof err === "object" && err !== null && "message" in err
}
