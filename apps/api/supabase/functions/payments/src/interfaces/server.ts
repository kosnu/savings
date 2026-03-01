import { Hono } from "@hono/hono"
import { cors } from "@hono/hono/cors"
import { createClient } from "@supabase/supabase-js"
import { registerPaymentsRoutes } from "./routes/index.ts"
import type { Database } from "../shared/types.ts"
import { type AuthVars, configAuthMiddleware } from "../shared/supabase/auth.ts"

type Vars = AuthVars

export const createServer = () => {
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")

    if (!supabaseUrl || !supabaseKey) {
      console.error(JSON.stringify({
        level: "error",
        message: "Supabase の接続情報が未設定です",
        missing: {
          SUPABASE_URL: !supabaseUrl,
          SUPABASE_ANON_KEY: !supabaseKey,
        },
      }))
      return c.json({ error: "Internal Server Error" }, 500)
    }

    c.set(
      "supabase",
      createClient<Database>(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
        global: {
          headers: {
            Authorization: c.req.raw.headers.get("Authorization") ?? "",
          },
        },
      }),
    )
    await next()
  })

  configAuthMiddleware(app)
  registerPaymentsRoutes(app)

  return app
}
