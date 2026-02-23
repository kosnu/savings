import { vi } from "vitest"

/**
 * Supabase Auth をモックし、ダミーアクセストークンを返す。
 * テストファイルで `vi.mock` と組み合わせて使用する。
 *
 * @example
 * ```ts
 * vi.mock("../../lib/supabase", () => ({ getSupabaseClient: mockGetSupabaseClient }))
 * ```
 */
export function mockGetSupabaseClient() {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            access_token: "test-access-token",
          },
        },
        error: null,
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  }
}
