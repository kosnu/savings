import { beforeEach, describe, expect, test } from "vite-plus/test"

import { i18next } from "../../i18n"
import { createProfileHandlers } from "../../test/msw/handlers/profile"
import { server } from "../../test/msw/server"
import { render, screen, waitFor } from "../../test/test-utils"
import { LanguageSyncProvider } from "./LanguageSyncProvider"

describe("LanguageSyncProvider", () => {
  beforeEach(async () => {
    window.localStorage.clear()
    await i18next.changeLanguage("en")
    server.resetHandlers(...createProfileHandlers())
  })

  test("保存済みのアカウント言語を端末へ反映する", async () => {
    server.resetHandlers(
      ...createProfileHandlers({
        get: { response: { name: "Test User", email: "test@example.com", language: "ja" } },
      }),
    )

    render(
      <LanguageSyncProvider>
        <span>Application</span>
      </LanguageSyncProvider>,
    )

    expect(screen.getByText("Application")).toBeInTheDocument()
    await waitFor(() => {
      expect(i18next.resolvedLanguage).toBe("ja")
      expect(window.localStorage.getItem("appLanguage")).toBe("ja")
    })
  })

  test("アカウントが未設定なら既存の端末言語を維持する", async () => {
    await i18next.changeLanguage("ja")

    render(
      <LanguageSyncProvider>
        <span>Application</span>
      </LanguageSyncProvider>,
    )

    await waitFor(() => expect(window.localStorage.getItem("appLanguage")).toBe("ja"))
    expect(i18next.resolvedLanguage).toBe("ja")
  })

  test("取得に失敗してもアプリを表示し続ける", async () => {
    server.resetHandlers(...createProfileHandlers({ get: { error: true } }))

    render(
      <LanguageSyncProvider>
        <span>Application</span>
      </LanguageSyncProvider>,
    )

    expect(screen.getByText("Application")).toBeInTheDocument()
    await waitFor(() => expect(i18next.resolvedLanguage).toBe("en"))
  })
})
