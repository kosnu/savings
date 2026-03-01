import type { Hono } from "@hono/hono"
import { paymentsController } from "../handlers/paymentsController.ts"
import { getUserIdByExternalId } from "../../infrastructure/utils/getUserIdByExternalId.ts"
import { createErrorResponse } from "../handlers/errorResponse.ts"
import type { AuthVars } from "../../shared/supabase/auth.ts"

export const registerPaymentsRoutes = (
  app: Hono<{ Variables: AuthVars }>,
) => {
  app.get("/payments", async (c) => {
    const supabase = c.var.supabase
    const externalUserId = c.var.externalUserId

    // external_id (Auth UUID) から users テーブルの id (number) を取得
    const userIdResult = await getUserIdByExternalId(supabase, externalUserId)
    if (!userIdResult.isOk) {
      return createErrorResponse(userIdResult.error)
    }

    // クエリパラメータ取得
    const dateFrom = c.req.query("dateFrom")
    const dateTo = c.req.query("dateTo")

    return await paymentsController.search(
      supabase,
      userIdResult.value,
      dateFrom,
      dateTo,
    )
  })

  app.get("/payments/total", async (c) => {
    const supabase = c.var.supabase

    const month = c.req.query("month")
    return await paymentsController.monthlyTotal(supabase, month)
  })

  app.post("/payments", async (c) => {
    const supabase = c.var.supabase
    const externalUserId = c.var.externalUserId

    // external_id (Auth UUID) から users テーブルの id (number) を取得
    const userIdResult = await getUserIdByExternalId(supabase, externalUserId)
    if (!userIdResult.isOk) {
      return createErrorResponse(userIdResult.error)
    }

    const body = await c.req.json()

    return await paymentsController.create(
      supabase,
      userIdResult.value,
      body,
    )
  })

  app.delete("/payments/:id", async (_c) => {
    return new Response(
      JSON.stringify({ message: "Not Implemented" }),
      {
        status: 501,
        headers: { "content-type": "application/json; charset=utf-8" },
      },
    )
  })
}
