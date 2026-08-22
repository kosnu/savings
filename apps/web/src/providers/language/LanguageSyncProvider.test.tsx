import { QueryClientProvider, type QueryClient } from "@tanstack/react-query"
import { HttpResponse, delay, http } from "msw"
import { beforeEach, describe, expect, test } from "vite-plus/test"

import { profileQueryKeys } from "../../features/profile"
import { i18next } from "../../i18n"
import { mockSession } from "../../test/data/supabaseSession"
import { createProfileHandlers } from "../../test/msw/handlers/profile"
import { server } from "../../test/msw/server"
import { act, createTestQueryClient, render, screen, waitFor } from "../../test/test-utils"
import {
  SupabaseSessionContext,
  type SupabaseSessionState,
} from "../supabase/SupabaseSessionProvider"
import { LanguageSyncProvider } from "./LanguageSyncProvider"

function LanguageSyncHarness({
  queryClient,
  sessionState,
}: {
  queryClient: QueryClient
  sessionState: SupabaseSessionState
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseSessionContext value={sessionState}>
        <LanguageSyncProvider>
          <span>Application</span>
        </LanguageSyncProvider>
      </SupabaseSessionContext>
    </QueryClientProvider>
  )
}

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

  test("同じユーザーのsession更新では表示準備済み状態を維持する", async () => {
    const queryClient = createTestQueryClient()
    const initialSession = mockSession({ access_token: "initial-token" })
    server.resetHandlers(
      ...createProfileHandlers({
        get: { response: { name: "Test User", email: "test@example.com", language: "ja" } },
      }),
    )

    const { rerender } = render(
      <LanguageSyncHarness
        queryClient={queryClient}
        sessionState={{
          status: "authenticated",
          session: initialSession,
          authenticationGeneration: 1,
        }}
      />,
      { withProviders: false },
    )

    expect(await screen.findByText("Application")).toBeInTheDocument()

    rerender(
      <LanguageSyncHarness
        queryClient={queryClient}
        sessionState={{
          status: "authenticated",
          session: mockSession({ access_token: "refreshed-token" }),
          authenticationGeneration: 1,
        }}
      />,
    )

    expect(screen.getByText("Application")).toBeInTheDocument()
  })

  test("サインアウト後の同一ユーザー再ログインでは準備完了を再判定する", async () => {
    const queryClient = createTestQueryClient()
    const session = mockSession()
    let profileGetCount = 0
    let profileLanguage: "en" | "ja" = "en"

    server.resetHandlers(
      http.get("*/rest/v1/users*", async () => {
        profileGetCount += 1
        await delay(100)
        return HttpResponse.json({
          name: "Test User",
          email: "test@example.com",
          language: profileLanguage,
        })
      }),
    )

    const { rerender } = render(
      <LanguageSyncHarness
        queryClient={queryClient}
        sessionState={{
          status: "authenticated",
          session,
          authenticationGeneration: 1,
        }}
      />,
      { withProviders: false },
    )

    expect(await screen.findByText("Application")).toBeInTheDocument()
    expect(profileGetCount).toBe(1)
    expect(i18next.resolvedLanguage).toBe("en")

    rerender(
      <LanguageSyncHarness
        queryClient={queryClient}
        sessionState={{
          status: "unauthenticated",
          session: null,
          authenticationGeneration: 1,
        }}
      />,
    )
    await act(async () => Promise.resolve())
    profileLanguage = "ja"

    rerender(
      <LanguageSyncHarness
        queryClient={queryClient}
        sessionState={{
          status: "authenticated",
          session: mockSession(),
          authenticationGeneration: 2,
        }}
      />,
    )

    expect(screen.queryByText("Application")).not.toBeInTheDocument()
    expect(await screen.findByText("Application")).toBeInTheDocument()
    expect(profileGetCount).toBe(2)
    expect(i18next.resolvedLanguage).toBe("ja")
  })
})
