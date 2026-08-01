import { HttpResponse, http } from "msw"
import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { createProfileHandlers } from "../../../test/msw/handlers/profile"
import { server } from "../../../test/msw/server"
import { supabaseTestClient } from "../../../test/utils/createSupabaseTestClient"
import { fetchLanguagePreference } from "./fetchLanguagePreference"

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => supabaseTestClient,
}))

describe("fetchLanguagePreference", () => {
  beforeEach(() => {
    server.resetHandlers(...createProfileHandlers())
  })

  it("現在ユーザーの保存済み言語を取得する", async () => {
    server.resetHandlers(
      ...createProfileHandlers({
        get: {
          response: { name: "Taro", email: "taro@example.com", language: "ja" },
        },
      }),
    )

    await expect(fetchLanguagePreference("mock-user-id")).resolves.toBe("ja")
  })

  it("現在ユーザーの行に絞り、languageだけを取得する", async () => {
    let requestUrl: URL | undefined

    server.use(
      http.get("*/rest/v1/users*", ({ request }) => {
        requestUrl = new URL(request.url)
        return HttpResponse.json({ language: null })
      }),
    )

    await expect(fetchLanguagePreference("mock-user-id")).resolves.toBeNull()
    expect(requestUrl?.searchParams.get("auth_user_id")).toBe("eq.mock-user-id")
    expect(requestUrl?.searchParams.get("select")).toBe("language")
  })

  it("Supabaseがエラーを返した場合にthrowする", async () => {
    server.resetHandlers(...createProfileHandlers({ get: { error: true } }))

    await expect(fetchLanguagePreference("mock-user-id")).rejects.toThrow(
      "Failed to fetch profile.",
    )
  })

  it("対象行またはlanguageの値が不正ならエラーにする", async () => {
    server.use(
      http.get("*/rest/v1/users*", () => {
        return HttpResponse.json({ language: "fr" })
      }),
    )

    await expect(fetchLanguagePreference("mock-user-id")).rejects.toThrow(
      "Invalid language preference response",
    )

    server.use(
      http.get("*/rest/v1/users*", () => {
        return HttpResponse.json(null)
      }),
    )

    await expect(fetchLanguagePreference("mock-user-id")).rejects.toThrow(
      "Invalid language preference response",
    )
  })
})
