import type { Decorator } from "@storybook/react-vite"
import { RouterProvider } from "@tanstack/react-router"
import { createTestRouter } from "./createTestRouter"

export function createStoryRouter(initialEntry: string): Decorator {
  return (Story) => {
    const router = createTestRouter(initialEntry, {
      defaultComponent: Story,
    })

    return <RouterProvider router={router} />
  }
}
