import type { Session } from "@supabase/supabase-js"
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router"
import { useEffect } from "react"
import { describe, expect, test, vi } from "vite-plus/test"

import type { AuthStatus } from "../../providers/supabase/SupabaseSessionProvider"
import { ThemeProvider } from "../../providers/theme/ThemeProvider"
import { mockSession } from "../../test/data/supabaseSession"
import { render, waitFor } from "../../test/test-utils"
import { router as appRouter } from "../routes"

vi.mock("../../lib/supabase", () => ({
  getSupabaseClient: () => ({
    auth: {
      signOut: vi.fn(async () => ({ error: null })),
    },
  }),
}))

vi.mock("./HomePage", () => ({ HomePage: () => <div>Home</div> }))
vi.mock("./AuthPage", () => ({ AuthPage: () => <div>Auth</div> }))
vi.mock("./PaymentsPage", () => ({ PaymentsPage: () => <div>Payments</div> }))

// 認証状態の復元タイミングを検証するため、Storyではなく本番のroute treeを使う。
function createRedirectTestRouter(initialEntry: string) {
  return createRouter({
    routeTree: appRouter.options.routeTree,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
    context: { authStatus: "loading", supabaseSession: null },
  })
}

function TestRouterProvider({
  router,
  session,
  authStatus,
}: {
  router: ReturnType<typeof createRedirectTestRouter>
  session: Session | null
  authStatus: AuthStatus
}) {
  useEffect(() => {
    void router.invalidate()
  }, [router, authStatus, session])

  return (
    <ThemeProvider>
      <RouterProvider router={router} context={{ supabaseSession: session, authStatus }} />
    </ThemeProvider>
  )
}

function renderWithSession(
  router: ReturnType<typeof createRedirectTestRouter>,
  state: { session: Session | null; authStatus: AuthStatus },
) {
  return render(
    <TestRouterProvider router={router} session={state.session} authStatus={state.authStatus} />,
    { withProviders: false },
  )
}

describe("route auth redirects", () => {
  test("ログイン済みユーザーはセッション復元後もトップページに留まる", async () => {
    const router = createRedirectTestRouter("/")

    const view = renderWithSession(router, {
      session: null,
      authStatus: "loading",
    })

    view.rerender(
      <TestRouterProvider router={router} session={mockSession()} authStatus="authenticated" />,
    )

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/")
    })
  })

  test("ログイン済みユーザーはセッション復元後に /auth からトップページへ遷移する", async () => {
    const router = createRedirectTestRouter("/auth")

    const view = renderWithSession(router, {
      session: null,
      authStatus: "loading",
    })

    view.rerender(
      <TestRouterProvider router={router} session={mockSession()} authStatus="authenticated" />,
    )

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/")
    })
  })

  test("未ログインユーザーはセッション確定後に保護ルートから / へ戻される", async () => {
    const router = createRedirectTestRouter("/payments")

    const view = renderWithSession(router, {
      session: null,
      authStatus: "loading",
    })

    view.rerender(
      <TestRouterProvider router={router} session={null} authStatus="unauthenticated" />,
    )

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/")
    })
  })
})
