import { beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { ensureAuthenticatedUser } from "./ensureAuthenticatedUser"

const { mockRpc } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
}))

vi.mock("../../lib/supabase", () => ({
  getSupabaseClient: () => ({
    rpc: mockRpc,
  }),
}))

describe("ensureAuthenticatedUser", () => {
  beforeEach(() => {
    mockRpc.mockReset()
  })

  test("初期表示名を渡してユーザー作成RPCを呼ぶ", async () => {
    mockRpc.mockResolvedValueOnce({ error: null })

    await ensureAuthenticatedUser("Initial User")

    expect(mockRpc).toHaveBeenCalledWith("ensure_authenticated_user", {
      p_initial_display_name: "Initial User",
    })
  })

  test("RPCがエラーを返した場合はthrowする", async () => {
    const error = new Error("failed to ensure user")
    mockRpc.mockResolvedValueOnce({ error })

    await expect(ensureAuthenticatedUser("Initial User")).rejects.toBe(error)
  })
})
