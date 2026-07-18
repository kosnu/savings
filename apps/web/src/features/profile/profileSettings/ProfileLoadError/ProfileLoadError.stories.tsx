import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn, userEvent, within } from "storybook/test"

import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { ProfileLoadError } from "./ProfileLoadError"

const meta = {
  title: "Features/Profile/ProfileSettings/ProfileLoadError",
  component: ProfileLoadError,
  tags: ["autodocs"],
  args: {
    onRetry: fn(async () => undefined),
  },
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
} satisfies Meta<typeof ProfileLoadError>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Retrying: Story = {
  args: {
    onRetry: fn(async () => await new Promise<void>(() => undefined)),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole("button", { name: "Try again" }))
  },
}

export const RetryFailed: Story = {
  args: {
    onRetry: fn(async () => {
      throw new Error("Failed to load profile.")
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole("button", { name: "Try again" }))
  },
}
