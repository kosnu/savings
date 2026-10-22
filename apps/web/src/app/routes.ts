import type { Session } from "@supabase/supabase-js"
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router"

import { resolveTargetMonth } from "../domain/date"
import { BookSettings } from "../features/books"
import { paymentsSearchSchema } from "../features/payments"
import { AppearanceSettings } from "../features/preferences"
import { ProfileSettings } from "../features/profile"
import type { AuthStatus } from "../providers/supabase/SupabaseSessionProvider"
import { AppLayout } from "./AppLayout"
import { AggregatesPage } from "./routes/AggregatesPage"
import { AuthPage } from "./routes/AuthPage"
import { DataManagementSettings } from "./routes/DataManagementSettings"
import { ErrorPage } from "./routes/ErrorPage"
import { HomePage } from "./routes/HomePage"
import { PaymentsPage } from "./routes/PaymentsPage"
import { PrivacyPage } from "./routes/PrivacyPage"
import { SettingsOverview } from "./routes/SettingsOverview"
import { SettingsPage } from "./routes/SettingsPage"
import { parseSearch, stringifySearch } from "./searchSerialization"

export interface RouterContext {
  authStatus: AuthStatus
  supabaseSession: Session | null
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  errorComponent: ErrorPage,
})

// 認証済みユーザーをトップページへリダイレクトするガード
function redirectIfAuthenticated({ context }: { context: RouterContext }) {
  if (context.authStatus === "loading") return
  if (context.authStatus === "authenticated") {
    throw redirect({ to: "/" })
  }
}

function normalizeMonthSearch({
  context,
  search,
  location,
}: {
  context: RouterContext
  search: { year?: string; month?: string; category?: string }
  location: { pathname: string }
}) {
  if (context.authStatus !== "authenticated") return

  const targetMonth = resolveTargetMonth(search.year, search.month)
  const year = String(targetMonth.year)
  const month = String(targetMonth.month)
  if (search.year === year && search.month === month) return

  throw redirect({
    to: location.pathname,
    search: { ...search, year, month },
    replace: true,
  })
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
  validateSearch: paymentsSearchSchema.pick({ year: true, month: true }),
  beforeLoad: normalizeMonthSearch,
})

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth",
  component: AuthPage,
  beforeLoad: redirectIfAuthenticated,
})

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/privacy",
  component: PrivacyPage,
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
  beforeLoad: normalizeMonthSearch,
})

const paymentDetailsRoute = createRoute({
  getParentRoute: () => paymentsRoute,
  path: "details/$paymentId",
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

const settingsIndexRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/",
  component: SettingsOverview,
})

const settingsBookRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "book",
  component: BookSettings,
})

const settingsProfileRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "profile",
  component: ProfileSettings,
})

const settingsAppearanceRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "appearance",
  component: AppearanceSettings,
})

const settingsDataManagementRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "data-management",
  component: DataManagementSettings,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  authRoute,
  privacyRoute,
  authenticatedRoute.addChildren([
    paymentsRoute.addChildren([paymentDetailsRoute]),
    aggregatesRoute,
    settingsRoute.addChildren([
      settingsIndexRoute,
      settingsProfileRoute,
      settingsAppearanceRoute,
      settingsBookRoute,
      settingsDataManagementRoute,
    ]),
  ]),
])

export const router = createRouter({
  routeTree,
  parseSearch,
  stringifySearch,
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
