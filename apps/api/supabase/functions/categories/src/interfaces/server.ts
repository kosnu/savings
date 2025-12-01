import { Hono } from "@hono/hono"
import type { SupabaseClient } from "@supabase/supabase-js"
import { registerCategoriesRoutes } from "./routes/index.ts"
import type { Database } from "../shared/types.ts"

type Vars = {
  supabase: SupabaseClient<Database>
}

type ServerDeps = {
  supabaseFactory: (req: Request) => SupabaseClient<Database>
}

export const createServer = (deps: ServerDeps) => {
  const app = new Hono<{ Variables: Vars }>()

  app.use("*", async (c, next) => {
    c.set("supabase", deps.supabaseFactory(c.req.raw))
    await next()
  })

  registerCategoriesRoutes(app)

  return app
}
