import { HttpResponse, http } from "msw"

const mockUser = {
  id: "mock-user-id",
  aud: "authenticated",
  role: "authenticated",
  email: "test@example.com",
  app_metadata: {},
  user_metadata: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

/**
 * Supabase クライアントが受け入れる形式の mock JWT を生成する。
 * setSession() が内部で JWT をデコードして有効期限を確認するため、
 * 正しい形式のトークンが必要。
 */
export function createMockJwt(): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const payload = btoa(
    JSON.stringify({
      sub: mockUser.id,
      exp: Math.floor(Date.now() / 1000) + 3600,
      aud: "authenticated",
      role: "authenticated",
      email: mockUser.email,
    }),
  )
  return `${header}.${payload}.mock-signature`
}

export const authHandlers = [
  // setSession() がトークン有効時に呼ぶユーザー情報取得
  http.get("*/auth/v1/user", () => {
    return HttpResponse.json(mockUser)
  }),

  // setSession() がトークン期限切れ時に呼ぶトークンリフレッシュ
  http.post("*/auth/v1/token", () => {
    return HttpResponse.json({
      access_token: createMockJwt(),
      refresh_token: "mock-refresh-token",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: "bearer",
      user: mockUser,
    })
  }),
]
