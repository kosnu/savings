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

function classifyJwtError(e: unknown): { code: string; message: string } {
  if (e instanceof jose.errors.JWTExpired) {
    return {
      code: "JWT_EXPIRED",
      message: "JWT verification failed: token expired",
    }
  }
  if (e instanceof jose.errors.JWTClaimValidationFailed) {
    return {
      code: "JWT_CLAIM_INVALID",
      message: "JWT verification failed: claim validation failed",
    }
  }
  if (e instanceof jose.errors.JWSSignatureVerificationFailed) {
    return {
      code: "JWT_SIGNATURE_INVALID",
      message: "JWT verification failed: signature verification failed",
    }
  }
  if (e instanceof jose.errors.JOSEError) {
    return {
      code: "JWT_VERIFICATION_FAILED",
      message: `JWT verification failed: ${e.message}`,
    }
  }
  return {
    code: "JWT_UNKNOWN_ERROR",
    message: "JWT verification failed: unknown error",
  }
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
    const { code, message } = classifyJwtError(e)

    console.error(JSON.stringify({
      level: "error",
      context: "jwt_auth",
      code,
      message,
    }))

    return c.json({ error: "Invalid JWT", code }, 401)
  }

  return next()
})

export const configAuthMiddleware = (
  app: Hono<{ Variables: { supabase: SupabaseClient<Database> } }>,
) => {
  app.use("*", authMiddleware)
}
