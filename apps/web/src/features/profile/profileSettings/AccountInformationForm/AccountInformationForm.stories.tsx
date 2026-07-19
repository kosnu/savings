import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn, userEvent, within } from "storybook/test"

import { DISPLAY_NAME_MAX_LENGTH } from "../../../../domain/displayName"
import { SnackbarProvider } from "../../../../providers/snackbar/SnackbarProvider"
import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { AccountInformationForm } from "./AccountInformationForm"

const defaultProfile = {
  name: "Test User",
  email: "test@example.com",
}

const meta = {
  title: "Features/Profile/ProfileSettings/AccountInformationForm",
  component: AccountInformationForm,
  tags: ["autodocs"],
  args: {
    profile: defaultProfile,
    loginMethod: "google",
    isPending: false,
    onSaveDisplayName: fn(async () => undefined),
  },
  decorators: [
    (Story) => (
      <ThemeProvider>
        <SnackbarProvider>
          <Story />
        </SnackbarProvider>
      </ThemeProvider>
    ),
  ],
} satisfies Meta<typeof AccountInformationForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const UnavailableLoginMethod: Story = {
  args: {
    loginMethod: "unavailable",
  },
}

export const ValidationError: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole("textbox", { name: "Display name" })

    await userEvent.clear(input)
    await userEvent.click(canvas.getByRole("button", { name: "Save" }))
  },
}

export const DisplayNameAtLimit: Story = {
  args: {
    onSaveDisplayName: fn(async () => undefined),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole("textbox", { name: "Display name" })

    await userEvent.clear(input)
    await userEvent.type(input, "a".repeat(DISPLAY_NAME_MAX_LENGTH))
    await userEvent.click(canvas.getByRole("button", { name: "Save" }))
  },
}

export const DisplayNameTooLong: Story = {
  args: {
    onSaveDisplayName: fn(async () => undefined),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole("textbox", { name: "Display name" })

    await userEvent.clear(input)
    await userEvent.type(input, "a".repeat(DISPLAY_NAME_MAX_LENGTH + 1))
    await userEvent.click(canvas.getByRole("button", { name: "Save" }))
  },
}

export const Saving: Story = {
  args: {
    onSaveDisplayName: fn(async () => new Promise<void>(() => undefined)),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole("textbox", { name: "Display name" })

    await userEvent.clear(input)
    await userEvent.type(input, "Pending User")
    await userEvent.click(canvas.getByRole("button", { name: "Save" }))
  },
}

export const SaveError: Story = {
  args: {
    onSaveDisplayName: fn(async () => {
      throw new Error("Failed to save display name.")
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole("textbox", { name: "Display name" })

    await userEvent.clear(input)
    await userEvent.type(input, "Unsaved User")
    await userEvent.click(canvas.getByRole("button", { name: "Save" }))
  },
}

export const Saved: Story = {
  args: {
    onSaveDisplayName: fn(async () => undefined),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole("textbox", { name: "Display name" })

    await userEvent.clear(input)
    await userEvent.type(input, "Updated User")
    await userEvent.click(canvas.getByRole("button", { name: "Save" }))
  },
}
