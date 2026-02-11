import type { Hono } from "@hono/hono"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../shared/types.ts"
import { paymentsController } from "../handlers/paymentsController.ts"
import { getUserIdByExternalId } from "../../infrastructure/utils/getUserIdByExternalId.ts"
import { createErrorResponse } from "../handlers/errorResponse.ts"
import { validationError } from "../../shared/errors.ts"

export const registerPaymentsRoutes = (
  app: Hono<{ Variables: { supabase: SupabaseClient<Database> } }>,
) => {
  app.get("/payments", async (c) => {
    const supabase = c.var.supabase

    // 認証情報取得
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(
        JSON.stringify({ message: "Unauthorized" }),
        {
          status: 401,
          headers: { "content-type": "application/json; charset=utf-8" },
        },
      )
    }

    // external_id (Auth UUID) から users テーブルの id (bigint) を取得
    const userIdResult = await getUserIdByExternalId(supabase, user.id)
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

  app.post("/payments", async (c) => {
    const supabase = c.var.supabase

    // 認証情報取得
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(
        JSON.stringify({ message: "Unauthorized" }),
        {
          status: 401,
          headers: { "content-type": "application/json; charset=utf-8" },
        },
      )
    }

    // external_id (Auth UUID) から users テーブルの id (bigint) を取得
    const userIdResult = await getUserIdByExternalId(supabase, user.id)
    if (!userIdResult.isOk) {
      return createErrorResponse(userIdResult.error)
    }

    let body: unknown
    try {
      body = await c.req.json()
    } catch (_e) {
      return createErrorResponse(validationError("Invalid JSON"))
    }

    return await paymentsController.create(
      supabase,
      userIdResult.value,
      body,
    )
  })
}
