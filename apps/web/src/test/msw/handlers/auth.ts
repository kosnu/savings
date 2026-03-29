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

interface GetUserHandlerOptions {
  response?: typeof mockUser
}

export function getUserHandler({ response = mockUser }: GetUserHandlerOptions = {}) {
  return http.get("*/auth/v1/user", () => {
    return HttpResponse.json(response)
  })
}

interface RefreshTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  expires_at: number
  token_type: string
  user: typeof mockUser
}

interface RefreshTokenHandlerOptions {
  response?: RefreshTokenResponse
}

export function refreshTokenHandler({ response }: RefreshTokenHandlerOptions = {}) {
  return http.post("*/auth/v1/token", () => {
    return HttpResponse.json(
      response ?? {
        access_token: createMockJwt(),
        refresh_token: "mock-refresh-token",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: "bearer",
        user: mockUser,
      },
    )
  })
}

interface CreateAuthHandlersOptions {
  getUser?: GetUserHandlerOptions
  refreshToken?: RefreshTokenHandlerOptions
}

export function createAuthHandlers({
  getUser = {},
  refreshToken = {},
}: CreateAuthHandlersOptions = {}) {
  return [getUserHandler(getUser), refreshTokenHandler(refreshToken)]
}

export const authHandlers = createAuthHandlers()
