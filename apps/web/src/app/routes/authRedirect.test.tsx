import type { Session } from "@supabase/supabase-js"
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
  RouterProvider,
} from "@tanstack/react-router"
import { render, waitFor } from "@testing-library/react"
import { useEffect } from "react"
import { describe, expect, test, vi } from "vitest"

import type { AuthStatus } from "../../providers/supabase/SupabaseSessionProvider"
import { ThemeProvider } from "../../providers/theme/ThemeProvider"
import { mockSession } from "../../test/data/supabaseSession"

vi.mock("../../lib/supabase", () => ({
  getSupabaseClient: () => ({
    auth: {
      signOut: vi.fn(async () => ({ error: null })),
    },
  }),
}))

interface TestRouterContext {
  authStatus: AuthStatus
  supabaseSession: Session | null
}

function createRedirectTestRouter(initialEntry: string) {
  const rootRoute = createRootRouteWithContext<TestRouterContext>()()

  // 認証済みユーザーを /payments へリダイレクトするガード
  function redirectIfAuthenticated({ context }: { context: TestRouterContext }) {
    if (context.authStatus === "loading") return
    if (context.authStatus === "authenticated") {
      throw redirect({ to: "/payments" })
    }
  }

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <div>Top</div>,
    beforeLoad: redirectIfAuthenticated,
  })

  const authRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/auth",
    component: () => <div>Auth</div>,
    beforeLoad: redirectIfAuthenticated,
  })

  const authenticatedRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: "authenticated",
    component: () => (
      <div>
        <div>AppLayout</div>
      </div>
    ),
    beforeLoad: ({ context }) => {
      if (context.authStatus === "loading") return
      if (context.authStatus !== "authenticated") {
        throw redirect({ to: "/" })
      }
    },
  })

  const paymentsRoute = createRoute({
    getParentRoute: () => authenticatedRoute,
    path: "/payments",
    component: () => <div>Payments</div>,
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([
      indexRoute,
      authRoute,
      authenticatedRoute.addChildren([paymentsRoute]),
    ]),
    history: createMemoryHistory({
      initialEntries: [initialEntry],
    }),
    context: {
      authStatus: "loading",
      supabaseSession: null,
    },
  })

  return router
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
  )
}

describe("route auth redirects", () => {
  test("ログイン済みユーザーはセッション復元後に / から /payments へ遷移する", async () => {
    const router = createRedirectTestRouter("/")

    const view = renderWithSession(router, {
      session: null,
      authStatus: "loading",
    })

    view.rerender(
      <TestRouterProvider router={router} session={mockSession()} authStatus="authenticated" />,
    )

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/payments")
    })
  })

  test("ログイン済みユーザーはセッション復元後に /auth から /payments へ遷移する", async () => {
    const router = createRedirectTestRouter("/auth")

    const view = renderWithSession(router, {
      session: null,
      authStatus: "loading",
    })

    view.rerender(
      <TestRouterProvider router={router} session={mockSession()} authStatus="authenticated" />,
    )

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/payments")
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
