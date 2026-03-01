import type { Session } from "@supabase/supabase-js"
import {
  createRootRouteWithContext,
  createRouter,
  redirect,
} from "@tanstack/react-router"
import { AppLayout } from "./AppLayout"
import { AggregatesPage } from "./routes/AggregatesPage"
import { AuthPage } from "./routes/AuthPage"
import { ErrorPage } from "./routes/ErrorPage"
import { PaymentsPage } from "./routes/PaymentsPage"
import { TopPage } from "./routes/TopPage"
import { createRouteTree } from "./routeTree"

export interface RouterContext {
  supabaseSession: Session | null
  supabaseLoading: boolean
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  errorComponent: ErrorPage,
})

const routeTree = createRouteTree(rootRoute, {
  indexComponent: TopPage,
  authComponent: AuthPage,
  authenticatedComponent: AppLayout,
  authenticatedBeforeLoad: ({ context }) => {
    if (context.supabaseLoading) return
    if (!context.supabaseSession) {
      throw redirect({ to: "/" })
    }
  },
  paymentsComponent: PaymentsPage,
  aggregatesComponent: AggregatesPage,
})

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
