import { HttpResponse, http } from "msw"
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { i18next } from "../../../../i18n"
import { createProfileHandlers } from "../../../../test/msw/handlers/profile"
import { server } from "../../../../test/msw/server"
import { render, screen, waitFor } from "../../../../test/test-utils"
import { LanguagePreferenceSync } from "./LanguagePreferenceSync"

describe("LanguagePreferenceSync", () => {
  beforeEach(async () => {
    window.localStorage.clear()
    await i18next.changeLanguage("en")
    server.resetHandlers(...createProfileHandlers())
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await i18next.changeLanguage("en")
    window.localStorage.clear()
  })

  test("保存済みaccount言語を端末内言語より優先して反映する", async () => {
    await i18next.changeLanguage("ja")
    server.resetHandlers(
      ...createProfileHandlers({
        get: {
          response: { name: "Taro", email: "taro@example.com", language: "en" },
        },
      }),
    )

    render(
      <>
        <LanguagePreferenceSync />
        <span>app content</span>
      </>,
    )

    expect(screen.getByText("app content")).toBeInTheDocument()
    await waitFor(() => {
      expect(i18next.resolvedLanguage).toBe("en")
      expect(window.localStorage.getItem("appLanguage")).toBe("en")
    })
  })

  test("account言語が未設定なら端末内言語を維持し、自動保存しない", async () => {
    let getRequestCount = 0
    let patchRequestCount = 0
    await i18next.changeLanguage("ja")
    server.use(
      http.get("*/rest/v1/users*", () => {
        getRequestCount += 1
        return HttpResponse.json({ language: null })
      }),
      http.patch("*/rest/v1/users*", () => {
        patchRequestCount += 1
        return HttpResponse.json({ auth_user_id: "mock-user-id", language: "ja" })
      }),
    )

    render(<LanguagePreferenceSync />)

    await waitFor(() => expect(getRequestCount).toBe(1))
    expect(i18next.resolvedLanguage).toBe("ja")
    expect(window.localStorage.getItem("appLanguage")).toBe("ja")
    expect(patchRequestCount).toBe(0)
  })

  test("取得失敗でも現在言語とchildrenを維持し、エラーを通知する", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    await i18next.changeLanguage("ja")
    server.resetHandlers(...createProfileHandlers({ get: { error: true } }))

    render(
      <>
        <LanguagePreferenceSync />
        <span>app content</span>
      </>,
    )

    expect(screen.getByText("app content")).toBeInTheDocument()
    expect(
      await screen.findByText(
        "保存済みの言語を読み込めませんでした。この端末の言語で引き続き利用できます。",
      ),
    ).toBeInTheDocument()
    expect(i18next.resolvedLanguage).toBe("ja")
    expect(window.localStorage.getItem("appLanguage")).toBe("ja")
  })
})
