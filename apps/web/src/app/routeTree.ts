import type { AnyRootRoute, RouteComponent } from "@tanstack/react-router"
import { createRoute } from "@tanstack/react-router"
import { paymentsSearchSchema } from "../features/payments/listPayment/paymentsSearchSchema"

export interface RouteTreeOptions {
  indexComponent?: RouteComponent
  authComponent?: RouteComponent
  authenticatedComponent?: RouteComponent
  authenticatedBeforeLoad?: (opts: { context: any }) => void
  paymentsComponent?: RouteComponent
  aggregatesComponent?: RouteComponent
}

export function createRouteTree<TRootRoute extends AnyRootRoute>(
  rootRoute: TRootRoute,
  options?: RouteTreeOptions,
) {
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: options?.indexComponent,
  })

  const authRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/auth",
    component: options?.authComponent,
  })

  const authenticatedRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: "authenticated",
    component: options?.authenticatedComponent,
    beforeLoad: options?.authenticatedBeforeLoad,
  })

  const paymentsRoute = createRoute({
    getParentRoute: () => authenticatedRoute,
    path: "/payments",
    component: options?.paymentsComponent,
    validateSearch: paymentsSearchSchema,
  })

  const aggregatesRoute = createRoute({
    getParentRoute: () => authenticatedRoute,
    path: "/aggregates",
    component: options?.aggregatesComponent,
  })

  return rootRoute.addChildren([
    indexRoute,
    authRoute,
    authenticatedRoute.addChildren([paymentsRoute, aggregatesRoute]),
  ])
}
