import { assertEquals } from "@std/assert"
import { Hono } from "@hono/hono"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../shared/types.ts"
import { registerPaymentsRoutes } from "./index.ts"

function createApp(
  supabase: Partial<SupabaseClient<Database>>,
) {
  const app = new Hono<{
    Variables: { supabase: SupabaseClient<Database> }
  }>()

  app.use("*", async (c, next) => {
    c.set("supabase", supabase as SupabaseClient<Database>)
    await next()
  })

  registerPaymentsRoutes(app)
  return app
}

const authenticatedSupabase = {
  auth: {
    getUser: () =>
      Promise.resolve({
        data: { user: { id: "auth-uuid-123" } },
        error: null,
      }),
  },
} as unknown as SupabaseClient<Database>

const unauthenticatedSupabase = {
  auth: {
    getUser: () =>
      Promise.resolve({
        data: { user: null },
        error: { message: "not authenticated" },
      }),
  },
} as unknown as SupabaseClient<Database>

Deno.test("DELETE /payments/:id は認証済みで501を返す", async () => {
  const app = createApp(authenticatedSupabase)

  const response = await app.request("/payments/123", {
    method: "DELETE",
  })
  const body = await response.json()

  assertEquals(response.status, 501)
  assertEquals(body, { message: "Not Implemented" })
})

Deno.test("DELETE /payments/:id は未認証で401を返す", async () => {
  const app = createApp(unauthenticatedSupabase)

  const response = await app.request("/payments/123", {
    method: "DELETE",
  })
  const body = await response.json()

  assertEquals(response.status, 401)
  assertEquals(body, { message: "Unauthorized" })
})
