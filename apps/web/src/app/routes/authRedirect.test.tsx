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
  supabaseSession: Session | null
  supabaseLoading: boolean
}

function createRedirectTestRouter(initialEntry: string) {
  const rootRoute = createRootRouteWithContext<TestRouterContext>()()

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <div>Top</div>,
    beforeLoad: ({ context }) => {
      if (context.supabaseLoading) return
      if (context.supabaseSession) {
        throw redirect({ to: "/payments" })
      }
    },
  })

  const authRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/auth",
    component: () => <div>Auth</div>,
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
      if (context.supabaseLoading) return
      if (!context.supabaseSession) {
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
      supabaseSession: null,
      supabaseLoading: true,
    },
  })

  return router
}

function TestRouterProvider({
  router,
  session,
  loading,
}: {
  router: ReturnType<typeof createRedirectTestRouter>
  session: Session | null
  loading: boolean
}) {
  useEffect(() => {
    void router.invalidate()
  }, [router, loading, session])

  return (
    <ThemeProvider>
      <RouterProvider
        router={router}
        context={{ supabaseSession: session, supabaseLoading: loading }}
      />
    </ThemeProvider>
  )
}

function renderWithSession(
  router: ReturnType<typeof createRedirectTestRouter>,
  state: { session: Session | null; loading: boolean },
) {
  return render(
    <TestRouterProvider router={router} session={state.session} loading={state.loading} />,
  )
}

describe("route auth redirects", () => {
  test("ログイン済みユーザーはセッション復元後に / から /payments へ遷移する", async () => {
    const router = createRedirectTestRouter("/")

    const view = renderWithSession(router, {
      session: null,
      loading: true,
    })

    view.rerender(<TestRouterProvider router={router} session={mockSession()} loading={false} />)

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/payments")
    })
  })

  test("未ログインユーザーはセッション確定後に保護ルートから / へ戻される", async () => {
    const router = createRedirectTestRouter("/payments")

    const view = renderWithSession(router, {
      session: null,
      loading: true,
    })

    view.rerender(<TestRouterProvider router={router} session={null} loading={false} />)

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/")
    })
  })
})
