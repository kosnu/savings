import { Hono } from "@hono/hono"
import { cors } from "@hono/hono/cors"
import type { SupabaseClient } from "@supabase/supabase-js"
import { registerCategoriesRoutes } from "./routes/index.ts"
import type { Database } from "../shared/types.ts"
import { configAuthMiddleware } from "../shared/supabase/auth.ts"

type Vars = {
  supabase: SupabaseClient<Database>
}

type ServerDeps = {
  supabaseFactory: (req: Request) => SupabaseClient<Database>
}

export const createServer = (deps: ServerDeps) => {
  const app = new Hono<{ Variables: Vars }>()

  app.use(
    "*",
    cors({
      origin: ["https://savingsv2.kosnu.dev", "http://localhost:5173"],
      allowHeaders: ["Authorization", "Content-Type"],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    }),
  )

  app.use("*", async (c, next) => {
    c.set("supabase", deps.supabaseFactory(c.req.raw))
    await next()
  })

  configAuthMiddleware(app)
  registerCategoriesRoutes(app)

  return app
}
