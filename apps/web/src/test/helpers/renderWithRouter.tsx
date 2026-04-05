import type { AnyRootRoute } from "@tanstack/react-router"
import { RouterProvider } from "@tanstack/react-router"

import type { TestRenderOptions } from "../test-utils"
import { render } from "../test-utils"
import { createTestRouter, type TestRouteBuilder } from "./createTestRouter"

export function renderWithRouter(
  initialEntry: string,
  routeBuilder: TestRouteBuilder,
  options: TestRenderOptions = {},
) {
  const router = createTestRouter(initialEntry, routeBuilder)

  return {
    router,
    ...render(<RouterProvider router={router} />, options),
  }
}

export type { AnyRootRoute }
