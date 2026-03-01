import { assertEquals } from "@std/assert"
import { Hono } from "@hono/hono"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../shared/types.ts"
import type { AuthVars } from "../../shared/supabase/auth.ts"
import { registerPaymentsRoutes } from "./index.ts"

function createApp() {
  const app = new Hono<{
    Variables: AuthVars
  }>()

  app.use("*", async (c, next) => {
    c.set("supabase", {} as SupabaseClient<Database>)
    c.set("externalUserId", "auth-uuid-123")
    await next()
  })

  registerPaymentsRoutes(app)
  return app
}

Deno.test("DELETE /payments/:id は501を返す", async () => {
  const app = createApp()

  const response = await app.request("/payments/123", {
    method: "DELETE",
  })
  const body = await response.json()

  assertEquals(response.status, 501)
  assertEquals(body, { message: "Not Implemented" })
})
