import type { Session } from "@supabase/supabase-js"

export function mockSession(overrides?: Partial<Session>): Session {
  return {
    access_token: "mock-access-token",
    refresh_token: "mock-refresh-token",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: "mock-user-id",
      aud: "authenticated",
      role: "authenticated",
      email: "test@example.com",
      app_metadata: {},
      user_metadata: {},
      created_at: "",
    },
    ...overrides,
  }
}
