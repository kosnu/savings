import type { Session } from "@supabase/supabase-js"
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router"
import { paymentsSearchSchema } from "../features/payments/listPayment/paymentsSearchSchema"
import { AppLayout } from "./AppLayout"
import { AggregatesPage } from "./routes/AggregatesPage"
import { AuthPage } from "./routes/AuthPage"
import { ErrorPage } from "./routes/ErrorPage"
import { PaymentsPage } from "./routes/PaymentsPage"
import { TopPage } from "./routes/TopPage"

export interface RouterContext {
  supabaseSession: Session | null
  supabaseLoading: boolean
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  errorComponent: ErrorPage,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: TopPage,
})

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth",
  component: AuthPage,
})

const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "authenticated",
  component: AppLayout,
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
  component: PaymentsPage,
  validateSearch: paymentsSearchSchema,
})

const aggregatesRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/aggregates",
  component: AggregatesPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  authRoute,
  authenticatedRoute.addChildren([paymentsRoute, aggregatesRoute]),
])

export const router = createRouter({
  routeTree,
  context: {
    supabaseSession: null,
    supabaseLoading: true,
  },
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
