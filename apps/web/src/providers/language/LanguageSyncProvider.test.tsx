import { beforeEach, describe, expect, test } from "vite-plus/test"

import { profileQueryKeys } from "../../features/profile"
import { i18next } from "../../i18n"
import { createProfileHandlers } from "../../test/msw/handlers/profile"
import { server } from "../../test/msw/server"
import { createTestQueryClient, render, screen, waitFor } from "../../test/test-utils"
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

    expect(screen.queryByText("Application")).not.toBeInTheDocument()
    expect(await screen.findByText("Application")).toBeInTheDocument()
    await waitFor(() => {
      expect(i18next.resolvedLanguage).toBe("ja")
      expect(window.localStorage.getItem("appLanguage")).toBe("ja")
    })
  })

  test("cache後に取得したアカウント言語を初回表示へ反映する", async () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(profileQueryKeys.current("mock-user-id"), {
      name: "Cached User",
      email: "cached@example.com",
      language: "en",
    })
    server.resetHandlers(
      ...createProfileHandlers({
        get: {
          response: { name: "Fresh User", email: "fresh@example.com", language: "ja" },
          durationOrMode: 100,
        },
      }),
    )

    render(
      <LanguageSyncProvider>
        <span>Application</span>
      </LanguageSyncProvider>,
      { queryClient },
    )

    expect(screen.queryByText("Application")).not.toBeInTheDocument()
    expect(await screen.findByText("Application")).toBeInTheDocument()
    expect(i18next.resolvedLanguage).toBe("ja")
    expect(window.localStorage.getItem("appLanguage")).toBe("ja")
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

    expect(screen.queryByText("Application")).not.toBeInTheDocument()
    expect(await screen.findByText("Application")).toBeInTheDocument()
    await waitFor(() => expect(i18next.resolvedLanguage).toBe("en"))
  })
})
