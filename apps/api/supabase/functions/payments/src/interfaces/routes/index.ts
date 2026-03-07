import type { Hono } from "@hono/hono"
import { paymentsController } from "../handlers/paymentsController.ts"
import type { AuthVars } from "../../shared/supabase/auth.ts"

export const registerPaymentsRoutes = (
  app: Hono<{ Variables: AuthVars }>,
) => {
  app.get("/payments/total", async (c) => {
    const supabase = c.var.supabase

    const month = c.req.query("month")
    return await paymentsController.monthlyTotal(supabase, month)
  })

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
