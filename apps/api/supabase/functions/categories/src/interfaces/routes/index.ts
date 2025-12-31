import type { Hono } from "@hono/hono"
import { categoriesController } from "../handlers/categoriesController.ts"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../shared/types.ts"

export const registerCategoriesRoutes = (
  app: Hono<{ Variables: { supabase: SupabaseClient<Database> } }>,
) => {
  app.get(
    "/categories",
    async (c) => {
      return await categoriesController.getAll(c.var.supabase)
    },
  )
}
