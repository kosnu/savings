import type { Meta, StoryObj } from "@storybook/react-vite"
import type { Decorator } from "@storybook/react-vite"

import { createStoryRouter } from "../../../test/helpers/routerDecorator"
import { AuthPage } from "./AuthPage"

const meta = {
  component: AuthPage,
} satisfies Meta<typeof AuthPage>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [createAuthPageRouter("/auth")],
}

export const WithAuthError: Story = {
  decorators: [
    createAuthPageRouter(
      "/auth?error=server_error&error_code=unexpected_failure&error_description=Unable+to+exchange+external+code%3A+abc",
    ),
  ],
}

function createAuthPageRouter(initialEntry: string): Decorator {
  const decorateWithRouter = createStoryRouter(initialEntry)

  return (Story) => {
    window.history.replaceState({}, "", initialEntry)
    return decorateWithRouter(Story)
  }
}
