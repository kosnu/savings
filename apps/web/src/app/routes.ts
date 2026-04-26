import type { Session } from "@supabase/supabase-js"
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router"

import { LatestMonthlyBudget } from "../features/budgets/latestMonthlyBudget"
import { paymentsSearchSchema } from "../features/payments/listPayment/paymentsSearchSchema"
import type { AuthStatus } from "../providers/supabase/SupabaseSessionProvider"
import { AppLayout } from "./AppLayout"
import { AggregatesPage } from "./routes/AggregatesPage"
import { AuthPage } from "./routes/AuthPage"
import { ErrorPage } from "./routes/ErrorPage"
import { PaymentsPage } from "./routes/PaymentsPage"
import { SettingsPage } from "./routes/SettingsPage"
import { TopPage } from "./routes/TopPage"

export interface RouterContext {
  authStatus: AuthStatus
  supabaseSession: Session | null
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  errorComponent: ErrorPage,
})

// 認証済みユーザーを /payments へリダイレクトするガード
function redirectIfAuthenticated({ context }: { context: RouterContext }) {
  if (context.authStatus === "loading") return
  if (context.authStatus === "authenticated") {
    throw redirect({ to: "/payments" })
  }
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: TopPage,
  beforeLoad: redirectIfAuthenticated,
})

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth",
  component: AuthPage,
  beforeLoad: redirectIfAuthenticated,
})

const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "authenticated",
  component: AppLayout,
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
  component: PaymentsPage,
  validateSearch: paymentsSearchSchema,
})

const aggregatesRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/aggregates",
  component: AggregatesPage,
})

const settingsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/settings",
  component: SettingsPage,
})

const settingsBudgetsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "budgets",
  component: LatestMonthlyBudget,
})

const budgetsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/budgets",
  beforeLoad: () => {
    throw redirect({ to: "/settings/budgets" })
  },
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  authRoute,
  authenticatedRoute.addChildren([
    paymentsRoute,
    aggregatesRoute,
    settingsRoute.addChildren([settingsBudgetsRoute]),
    budgetsRoute,
  ]),
])

export const router = createRouter({
  routeTree,
  context: {
    authStatus: "loading",
    supabaseSession: null,
  },
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
