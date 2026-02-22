import type { Hono } from "@hono/hono"
import { createMiddleware } from "@hono/hono/factory"
import * as jose from "jose"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../types.ts"

async function verifySupabaseJWT(token: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const jwks = jose.createRemoteJWKSet(
    new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`),
  )
  // issuer チェックを外す（ローカルでは SUPABASE_URL と トークンの iss が異なるため）
  return await jose.jwtVerify(token, jwks)
}

const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("Authorization")
  if (!authHeader) {
    return c.json({ error: "Missing Authorization header" }, 401)
  }
  if (!authHeader.startsWith("Bearer ")) {
    return c.json(
      {
        error: "Invalid Authorization header format, expected 'Bearer <token>'",
      },
      401,
    )
  }

  const token = authHeader.slice(7)
  try {
    await verifySupabaseJWT(token)
  } catch (e) {
    console.error("JWT verification error:", e)
    return c.json({ error: "Invalid JWT" }, 401)
  }

  return next()
})

export const configAuthMiddleware = (
  app: Hono<{ Variables: { supabase: SupabaseClient<Database> } }>,
) => {
  app.use("*", authMiddleware)
}
