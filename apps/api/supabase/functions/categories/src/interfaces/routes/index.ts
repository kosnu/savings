import type { Hono } from "@hono/hono"
import { categoriesController } from "../handlers/categoriesController.ts"
import type { AuthVars } from "../../shared/supabase/auth.ts"

export const registerCategoriesRoutes = (
  app: Hono<{ Variables: AuthVars }>,
) => {
  app.get(
    "/categories",
    async (c) => {
      return await categoriesController.getAll(c.var.supabase)
    },
  )
}
