import { HttpResponse, http } from "msw"
import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { createProfileHandlers } from "../../../test/msw/handlers/profile"
import { server } from "../../../test/msw/server"
import { supabaseTestClient } from "../../../test/utils/createSupabaseTestClient"
import { fetchProfile } from "./fetchProfile"

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => supabaseTestClient,
}))

describe("fetchProfile", () => {
  beforeEach(() => {
    server.resetHandlers(...createProfileHandlers())
  })

  it("現在ユーザーの表示名とemailを取得する", async () => {
    server.resetHandlers(
      ...createProfileHandlers({
        get: { response: { name: "Taro", email: "taro@example.com" } },
      }),
    )

    await expect(fetchProfile("mock-user-id")).resolves.toEqual({
      name: "Taro",
      email: "taro@example.com",
    })
  })

  it("現在ユーザーの行に絞り、必要な列だけを取得する", async () => {
    let requestUrl: URL | undefined

    server.use(
      http.get("*/rest/v1/users*", ({ request }) => {
        requestUrl = new URL(request.url)
        return HttpResponse.json({ name: "Taro", email: "taro@example.com" })
      }),
    )

    await fetchProfile("mock-user-id")

    expect(requestUrl?.searchParams.get("auth_user_id")).toBe("eq.mock-user-id")
    expect(requestUrl?.searchParams.get("select")).toBe("name,email")
  })

  it("Supabaseがエラーを返した場合にthrowする", async () => {
    server.resetHandlers(...createProfileHandlers({ get: { error: true } }))

    await expect(fetchProfile("mock-user-id")).rejects.toThrow("Failed to fetch profile.")
  })

  it("レスポンスshapeが不正ならエラーにする", async () => {
    server.use(
      http.get("*/rest/v1/users*", () => {
        return HttpResponse.json({ name: "Taro", email: "invalid-email" })
      }),
    )

    await expect(fetchProfile("mock-user-id")).rejects.toThrow("Invalid profile response")
  })
})
