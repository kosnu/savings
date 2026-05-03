import type { Args, Decorator } from "@storybook/react-vite"
import {
  createRoute,
  RouterProvider,
  type AnyRootRoute,
  type AnyRoute,
  type RouteComponent,
} from "@tanstack/react-router"

import { paymentsSearchSchema } from "../../features/payments/listPayment/paymentsSearchSchema"
import { createTestRouter } from "./createTestRouter"

type StoryRouteBuilder = (rootRoute: AnyRootRoute, Story: RouteComponent) => AnyRoute[]

export function createStoryRouter(
  initialEntry: string,
  routeBuilder?: StoryRouteBuilder,
): Decorator<Args> {
  return (Story) => {
    const defaultBuilder: StoryRouteBuilder = (root, StoryComponent) => [
      createRoute({
        getParentRoute: () => root,
        path: initialEntry.split("?")[0],
        component: StoryComponent,
      }),
    ]

    const builder = routeBuilder ?? defaultBuilder

    const router = createTestRouter(initialEntry, (root) => builder(root, Story))

    return <RouterProvider router={router} />
  }
}

export const paymentsRouteBuilder: StoryRouteBuilder = (root, Story) => {
  const authenticatedRoute = createRoute({
    getParentRoute: () => root,
    id: "authenticated",
  })

  const paymentsRoute = createRoute({
    getParentRoute: () => authenticatedRoute,
    path: "/payments",
    component: Story,
    validateSearch: paymentsSearchSchema,
  })

  const paymentDetailsRoute = createRoute({
    getParentRoute: () => paymentsRoute,
    path: "details/$paymentId",
  })

  return [authenticatedRoute.addChildren([paymentsRoute.addChildren([paymentDetailsRoute])])]
}
