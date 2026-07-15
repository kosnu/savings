import { HttpResponse, http } from "msw"
import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { createProfileHandlers } from "../../../test/msw/handlers/profile"
import { server } from "../../../test/msw/server"
import { supabaseTestClient } from "../../../test/utils/createSupabaseTestClient"
import { updateDisplayName } from "./updateDisplayName"

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => supabaseTestClient,
}))

describe("updateDisplayName", () => {
  beforeEach(() => {
    server.resetHandlers(...createProfileHandlers())
  })

  it("現在ユーザーのnameだけを更新する", async () => {
    let requestUrl: URL | undefined
    let requestBody: unknown

    server.use(
      http.patch("*/rest/v1/users*", async ({ request }) => {
        requestUrl = new URL(request.url)
        requestBody = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await updateDisplayName({ authUserId: "mock-user-id", name: "Taro" })

    expect(requestUrl?.searchParams.get("auth_user_id")).toBe("eq.mock-user-id")
    expect(requestBody).toEqual({ name: "Taro" })
  })

  it("Supabaseがエラーを返した場合にthrowする", async () => {
    server.resetHandlers(...createProfileHandlers({ update: { error: true } }))

    await expect(updateDisplayName({ authUserId: "mock-user-id", name: "Taro" })).rejects.toThrow(
      "Failed to save display name.",
    )
  })
})
