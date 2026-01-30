import type { Hono } from "@hono/hono"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../shared/types.ts"

export const registerPaymentsRoutes = (
  _app: Hono<{ Variables: { supabase: SupabaseClient<Database> } }>,
) => {
  // Register payment-related routes here
}
