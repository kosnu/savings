import type { Meta, StoryObj } from "@storybook/react-vite"

import { createStoryRouter } from "../../../test/helpers/routerDecorator"
import { AuthPage } from "./AuthPage"

const meta = {
  component: AuthPage,
  decorators: [createStoryRouter("/auth")],
} satisfies Meta<typeof AuthPage>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithAuthError: Story = {
  decorators: [
    (Story) => {
      window.history.replaceState(
        {},
        "",
        "/auth?error=server_error&error_code=unexpected_failure&error_description=Unable+to+exchange+external+code%3A+abc",
      )
      return <Story />
    },
    createStoryRouter(
      "/auth?error=server_error&error_code=unexpected_failure&error_description=Unable+to+exchange+external+code%3A+abc",
    ),
  ],
}
