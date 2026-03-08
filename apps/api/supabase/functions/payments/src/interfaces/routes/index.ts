import type { Hono } from "@hono/hono"
import type { AuthVars } from "../../shared/supabase/auth.ts"

export const registerPaymentsRoutes = (
  app: Hono<{ Variables: AuthVars }>,
) => {
  app.delete("/payments/:id", (_c) => {
    return new Response(
      JSON.stringify({ message: "Not Implemented" }),
      {
        status: 501,
        headers: { "content-type": "application/json; charset=utf-8" },
      },
    )
  })
}
