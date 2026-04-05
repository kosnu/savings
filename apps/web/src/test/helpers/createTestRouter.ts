import type { AnyRootRoute, AnyRoute } from "@tanstack/react-router"
import { createMemoryHistory, createRootRoute, createRouter } from "@tanstack/react-router"

export type TestRouteBuilder = (rootRoute: AnyRootRoute) => AnyRoute[]

export function createTestRouter(initialEntry: string, routeBuilder: TestRouteBuilder) {
  const rootRoute = createRootRoute()

  const routeTree = rootRoute.addChildren(routeBuilder(rootRoute))

  const memoryHistory = createMemoryHistory({
    initialEntries: [initialEntry],
  })

  return createRouter({ routeTree, history: memoryHistory })
}
