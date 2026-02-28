import type { Decorator } from "@storybook/react-vite"
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import { z } from "zod"

const paymentsSearchSchema = z.object({
  year: z.coerce.string().optional(),
  month: z.coerce.string().optional(),
})

export function createStoryRouter(initialEntry: string): Decorator {
  return (Story) => {
    const rootRoute = createRootRoute()

    const authenticatedRoute = createRoute({
      getParentRoute: () => rootRoute,
      id: "authenticated",
    })

    const paymentsRoute = createRoute({
      getParentRoute: () => authenticatedRoute,
      path: "/payments",
      validateSearch: paymentsSearchSchema,
    })

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/",
    })

    const authRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/auth",
    })

    const routeTree = rootRoute.addChildren([
      indexRoute,
      authRoute,
      authenticatedRoute.addChildren([paymentsRoute]),
    ])

    const memoryHistory = createMemoryHistory({
      initialEntries: [initialEntry],
    })

    const router = createRouter({
      routeTree,
      history: memoryHistory,
      defaultComponent: Story,
    })

    return <RouterProvider router={router} />
  }
}
