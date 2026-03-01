import { assertEquals } from "@std/assert"
import { Hono } from "@hono/hono"
import { type AuthVars, createAuthMiddleware, type VerifyJWT } from "./auth.ts"

function createTestApp(verifyJWT?: VerifyJWT) {
  const app = new Hono<{ Variables: AuthVars }>()
  app.use("*", createAuthMiddleware(verifyJWT))
  app.get("/test", (c) => c.json({ userId: c.var.externalUserId }))
  return app
}

const mockVerify: VerifyJWT = (_token: string) =>
  Promise.resolve({
    payload: { sub: "user-123" },
    protectedHeader: { alg: "RS256" as const },
    key: {} as CryptoKey,
  })

Deno.test("Authorizationヘッダなし → 401", async () => {
  const app = createTestApp(mockVerify)
  const res = await app.request("/test")
  assertEquals(res.status, 401)
  const body = await res.json()
  assertEquals(body.error, "Missing Authorization header")
})

Deno.test("Bearer形式不正 → 401", async () => {
  const app = createTestApp(mockVerify)
  const res = await app.request("/test", {
    headers: { Authorization: "Basic abc" },
  })
  assertEquals(res.status, 401)
  const body = await res.json()
  assertEquals(
    body.error,
    "Invalid Authorization header format, expected 'Bearer <token>'",
  )
})

Deno.test("JWT検証失敗 → 401 + エラーコード", async () => {
  const failVerify: VerifyJWT = (_token: string) =>
    Promise.reject(new Error("verification failed"))
  const app = createTestApp(failVerify)
  const res = await app.request("/test", {
    headers: { Authorization: "Bearer invalid-token" },
  })
  assertEquals(res.status, 401)
  const body = await res.json()
  assertEquals(body.error, "Invalid JWT")
  assertEquals(body.code, "JWT_UNKNOWN_ERROR")
})

Deno.test("subクレームなし → 401", async () => {
  const noSubVerify: VerifyJWT = (_token: string) =>
    Promise.resolve({
      payload: {},
      protectedHeader: { alg: "RS256" as const },
      key: {} as CryptoKey,
    })
  const app = createTestApp(noSubVerify)
  const res = await app.request("/test", {
    headers: { Authorization: "Bearer valid-token" },
  })
  assertEquals(res.status, 401)
  const body = await res.json()
  assertEquals(body.error, "Invalid JWT: missing sub claim")
})

Deno.test("正常系 → 200 + externalUserIdがセットされる", async () => {
  const app = createTestApp(mockVerify)
  const res = await app.request("/test", {
    headers: { Authorization: "Bearer valid-token" },
  })
  assertEquals(res.status, 200)
  const body = await res.json()
  assertEquals(body.userId, "user-123")
})
