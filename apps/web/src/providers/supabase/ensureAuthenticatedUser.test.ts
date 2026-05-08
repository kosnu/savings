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

  test("ユーザー作成RPCを引数なしで呼ぶ", async () => {
    mockRpc.mockResolvedValueOnce({ error: null })

    await ensureAuthenticatedUser()

    expect(mockRpc).toHaveBeenCalledWith("ensure_authenticated_user")
  })

  test("RPCがエラーを返した場合はthrowする", async () => {
    const error = new Error("failed to ensure user")
    mockRpc.mockResolvedValueOnce({ error })

    await expect(ensureAuthenticatedUser()).rejects.toBe(error)
  })
})
