import { HttpResponse, http } from "msw"
import { beforeEach, expect, it, vi } from "vite-plus/test"

import { server } from "../test/msw/server"
import { supabaseTestClient } from "../test/utils/createSupabaseTestClient"
import {
  loadAccountLanguage,
  resolveAccountLanguage,
  updateAccountLanguage,
} from "./accountLanguage"

vi.mock("../lib/supabase", () => ({
  getSupabaseClient: () => supabaseTestClient,
}))

const testNamePattern = (
  globalThis as typeof globalThis & {
    __vitest_worker__?: { config: { testNamePattern?: RegExp } }
  }
).__vitest_worker__?.config.testNamePattern

function testCase(name: string, callback: () => void | Promise<void>) {
  if (testNamePattern && !testNamePattern.test(name)) {
    return
  }

  it(name, callback)
}

beforeEach(() => {
  server.resetHandlers()
})

testCase("アカウント言語の取得元をpublic.users.languageに限定する", async () => {
  let requestUrl: URL | undefined

  server.use(
    http.get("*/rest/v1/users*", ({ request }) => {
      requestUrl = new URL(request.url)
      return HttpResponse.json({ language: "ja" })
    }),
  )

  await expect(loadAccountLanguage("user-id")).resolves.toBe("ja")
  expect(requestUrl?.searchParams.get("select")).toBe("language")
  expect(requestUrl?.searchParams.get("auth_user_id")).toBe("eq.user-id")
})

testCase("アカウント言語の保存対象が1件であることを確認する", async () => {
  let requestUrl: URL | undefined

  server.use(
    http.patch("*/rest/v1/users*", ({ request }) => {
      requestUrl = new URL(request.url)
      return HttpResponse.json({ auth_user_id: "user-id" })
    }),
  )

  await expect(
    updateAccountLanguage({ authUserId: "user-id", language: "ja" }),
  ).resolves.toBeUndefined()
  expect(requestUrl?.searchParams.get("auth_user_id")).toBe("eq.user-id")
})

testCase("アカウント言語を端末言語より優先する", () => {
  expect(resolveAccountLanguage("ja", "en")).toBe("ja")
})

testCase("未設定では端末言語へfallbackし自動保存しない", async () => {
  let updateCalled = false

  server.use(
    http.get("*/rest/v1/users*", () => HttpResponse.json({ language: null })),
    http.patch("*/rest/v1/users*", () => {
      updateCalled = true
      return HttpResponse.json({ auth_user_id: "user-id" })
    }),
  )

  const accountLanguage = await loadAccountLanguage("user-id")

  expect(resolveAccountLanguage(accountLanguage, "ja")).toBe("ja")
  expect(updateCalled).toBe(false)
})

testCase("取得失敗では端末言語へfallbackする", async () => {
  server.use(
    http.get("*/rest/v1/users*", () =>
      HttpResponse.json({ message: "Failed to fetch account language." }, { status: 500 }),
    ),
  )

  await expect(loadAccountLanguage("user-id")).rejects.toThrow("Failed to fetch account language.")
  expect(resolveAccountLanguage(undefined, "ja")).toBe("ja")
})

testCase("本人行のlanguageだけを更新する", async () => {
  let requestUrl: URL | undefined
  let requestBody: unknown

  server.use(
    http.patch("*/rest/v1/users*", async ({ request }) => {
      requestUrl = new URL(request.url)
      requestBody = await request.json()
      return HttpResponse.json({ auth_user_id: "user-id" })
    }),
  )

  await updateAccountLanguage({ authUserId: "user-id", language: "ja-JP" })

  expect(requestUrl?.searchParams.get("auth_user_id")).toBe("eq.user-id")
  expect(requestBody).toEqual({ language: "ja" })
})
