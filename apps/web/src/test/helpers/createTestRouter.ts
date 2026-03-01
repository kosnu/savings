import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router"
import type { RouteComponent } from "@tanstack/react-router"
import { createRouteTree } from "../../app/routeTree"

interface CreateTestRouterOptions {
  paymentsComponent?: RouteComponent
  defaultComponent?: RouteComponent
}

export function createTestRouter(
  initialEntry: string,
  options?: CreateTestRouterOptions,
) {
  const rootRoute = createRootRoute()

  const routeTree = createRouteTree(rootRoute, {
    paymentsComponent: options?.paymentsComponent,
  })

  const memoryHistory = createMemoryHistory({
    initialEntries: [initialEntry],
  })

  return createRouter({
    routeTree,
    history: memoryHistory,
    defaultComponent: options?.defaultComponent,
  })
}
