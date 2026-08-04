import { HttpResponse, http } from "msw"
import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { createProfileHandlers } from "../../../test/msw/handlers/profile"
import { server } from "../../../test/msw/server"
import { supabaseTestClient } from "../../../test/utils/createSupabaseTestClient"
import { updateLanguagePreference } from "./updateLanguagePreference"

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => supabaseTestClient,
}))

describe("updateLanguagePreference", () => {
  beforeEach(() => {
    server.resetHandlers(...createProfileHandlers())
  })

  it("現在ユーザーのlanguageだけを更新し、対象行と値を確認する", async () => {
    let requestUrl: URL | undefined
    let requestBody: unknown

    server.use(
      http.patch("*/rest/v1/users*", async ({ request }) => {
        requestUrl = new URL(request.url)
        requestBody = await request.json()
        return HttpResponse.json({ auth_user_id: "mock-user-id", language: "ja" })
      }),
    )

    await expect(
      updateLanguagePreference({ authUserId: "mock-user-id", language: "ja" }),
    ).resolves.toBeUndefined()

    expect(requestUrl?.searchParams.get("auth_user_id")).toBe("eq.mock-user-id")
    expect(requestUrl?.searchParams.get("select")).toBe("auth_user_id,language")
    expect(requestBody).toEqual({ language: "ja" })
  })

  it("Supabaseがエラーを返した場合にthrowする", async () => {
    server.resetHandlers(...createProfileHandlers({ update: { error: true } }))

    await expect(
      updateLanguagePreference({ authUserId: "mock-user-id", language: "ja" }),
    ).rejects.toThrow()
  })

  it("更新対象のIDまたはlanguageが一致しなければ成功扱いにしない", async () => {
    server.use(
      http.patch("*/rest/v1/users*", () => {
        return HttpResponse.json({ auth_user_id: "other-user-id", language: "ja" })
      }),
    )

    await expect(
      updateLanguagePreference({ authUserId: "mock-user-id", language: "ja" }),
    ).rejects.toThrow("Unable to confirm language preference update.")

    server.use(
      http.patch("*/rest/v1/users*", () => {
        return HttpResponse.json({ auth_user_id: "mock-user-id", language: "en" })
      }),
    )

    await expect(
      updateLanguagePreference({ authUserId: "mock-user-id", language: "ja" }),
    ).rejects.toThrow("Unable to confirm language preference update.")
  })

  it("更新対象が0件なら成功扱いにしない", async () => {
    server.use(
      http.patch("*/rest/v1/users*", () => {
        return HttpResponse.json([])
      }),
    )

    await expect(
      updateLanguagePreference({ authUserId: "mock-user-id", language: "ja" }),
    ).rejects.toThrow()
  })
})
