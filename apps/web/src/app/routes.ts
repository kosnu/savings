import type { Session } from "@supabase/supabase-js"
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router"

import { BookSettings } from "../features/books"
import { paymentsSearchSchema } from "../features/payments"
import { AppearanceSettings } from "../features/preferences"
import { ProfileSettings } from "../features/profile"
import { isSelectableMonth, MAX_MONTH_INDEX, MIN_MONTH_INDEX } from "../features/summaryByMonth"
import type { AuthStatus } from "../providers/supabase/SupabaseSessionProvider"
import { AppLayout } from "./AppLayout"
import { AggregatesPage } from "./routes/AggregatesPage"
import { AuthPage } from "./routes/AuthPage"
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

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
  validateSearch: paymentsSearchSchema.pick({ year: true, month: true }),
  beforeLoad: ({ context, search }) => {
    if (context.authStatus !== "authenticated") return

    const now = new Date()
    const currentMonth = { year: now.getFullYear(), month: now.getMonth() + 1 }
    const targetMonth = {
      year: Number(search.year ?? currentMonth.year),
      month: Number(search.month ?? currentMonth.month),
    }
    const isValid = isSelectableMonth(targetMonth)
    if (isValid && search.year !== undefined && search.month !== undefined) return

    const fallbackMonthIndex = Math.max(
      MIN_MONTH_INDEX,
      Math.min(MAX_MONTH_INDEX, currentMonth.year * 12 + currentMonth.month - 1),
    )
    const month = isValid
      ? targetMonth
      : { year: Math.floor(fallbackMonthIndex / 12), month: (fallbackMonthIndex % 12) + 1 }
    throw redirect({
      to: "/",
      search: { year: String(month.year), month: String(month.month) },
      replace: true,
    })
  },
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
