import type { Meta, StoryObj } from "@storybook/react-vite"

import { createAccountDeletionHandlers } from "../../../../test/msw/handlers/accountDeletion"
import { createProfileHandlers } from "../../../../test/msw/handlers/profile"
import { AccountSettings } from "./AccountSettings"

const meta = {
  title: "Features/Profile/AccountSettings",
  component: AccountSettings,
} satisfies Meta<typeof AccountSettings>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  parameters: {
    msw: {
      handlers: [
        ...createProfileHandlers(),
        ...createAccountDeletionHandlers({ preview: { response: { email: "test@example.com" } } }),
      ],
    },
  },
}
