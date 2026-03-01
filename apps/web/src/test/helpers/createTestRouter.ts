import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router"
import type { ComponentType } from "react"
import { paymentsSearchSchema } from "../../features/payments/listPayment/paymentsSearchSchema"

interface CreateTestRouterOptions {
  paymentsComponent?: ComponentType
  defaultComponent?: ComponentType
}

export function createTestRouter(
  initialEntry: string,
  options?: CreateTestRouterOptions,
) {
  const rootRoute = createRootRoute()

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
  })

  const authRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/auth",
  })

  const authenticatedRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: "authenticated",
  })

  const paymentsRoute = createRoute({
    getParentRoute: () => authenticatedRoute,
    path: "/payments",
    validateSearch: paymentsSearchSchema,
    component: options?.paymentsComponent,
  })

  const routeTree = rootRoute.addChildren([
    indexRoute,
    authRoute,
    authenticatedRoute.addChildren([paymentsRoute]),
  ])

  const memoryHistory = createMemoryHistory({
    initialEntries: [initialEntry],
  })

  return createRouter({
    routeTree,
    history: memoryHistory,
    defaultComponent: options?.defaultComponent,
  })
}
