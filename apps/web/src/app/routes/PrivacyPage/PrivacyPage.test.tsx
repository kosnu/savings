import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router"
import { describe, expect, test, vi } from "vite-plus/test"

import type { SupabaseSessionState } from "../../../providers/supabase/SupabaseSessionProvider"
import { mockSession } from "../../../test/data/supabaseSession"
import { render, screen } from "../../../test/test-utils"
import { router as appRouter } from "../../routes"

vi.mock("../../../utils/auth/useSupabaseSignIn", () => ({
  useSupabaseSignIn: () => ({ signIn: vi.fn() }),
}))

// Page Storyの表示確認とは別に、本番のrouteTreeと認証ガードを通る閲覧導線を検証する。
function renderApp(initialEntry: string, sessionState: SupabaseSessionState) {
  const router = createRouter({
    routeTree: appRouter.routeTree,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
    context: { authStatus: sessionState.status, supabaseSession: sessionState.session },
  })

  return { router, ...render(<RouterProvider router={router} />, { sessionState }) }
}

const unauthenticated = { status: "unauthenticated", session: null } as const
const authenticated = { status: "authenticated", session: mockSession() } as const

describe("プライバシーポリシーの公開ルート", () => {
  test.each([unauthenticated, authenticated])("$statusでもURLを直接開ける", async (state) => {
    const { router } = renderApp("/privacy", state)

    expect(
      await screen.findByRole("heading", { level: 1, name: "Privacy policy" }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/privacy")
  })

  test.each([
    { entry: "/", state: unauthenticated },
    { entry: "/auth", state: unauthenticated },
    { entry: "/settings", state: authenticated },
  ])("$entry からポリシーを開ける", async ({ entry, state }) => {
    const { router, user } = renderApp(entry, state)

    await user.click(await screen.findByRole("link", { name: "Privacy policy" }))

    expect(
      await screen.findByRole("heading", { level: 1, name: "Privacy policy" }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/privacy")
  })
})
