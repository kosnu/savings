import type { Session } from "@supabase/supabase-js"

export function mockSession(overrides?: Partial<Session>): Session {
  return {
    access_token: "mock-access-token",
    refresh_token: "mock-refresh-token",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    provider_token: "mock-provider-token",
    provider_refresh_token: "mock-provider-refresh-token",
    user: {
      id: "mock-user-id",
      aud: "authenticated",
      role: "authenticated",
      email: "test@example.com",
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    ...overrides,
  }
}
