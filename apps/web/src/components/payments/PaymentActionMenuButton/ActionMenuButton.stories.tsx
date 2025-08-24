import type { Meta, StoryObj } from "@storybook/react-vite"
import { within } from "@testing-library/react"
import { expect, fn, userEvent } from "storybook/test"
import { firebaseConfig } from "../../../config/firebase/test"
import { FirestoreProvider } from "../../../providers/firebase"
import { payments } from "../../../test/data/payments"
import { ActionMenuButton } from "./ActionMenuButton"

const meta = {
  title: "Common/Payments/ActionMenuButton",
  component: ActionMenuButton,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {},
  args: {
    onDeleteSuccess: fn(),
  },
  decorators: [
    (Story) => {
      return (
        <FirestoreProvider config={firebaseConfig}>
          <Story />
        </FirestoreProvider>
      )
    },
  ],
} satisfies Meta<typeof ActionMenuButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { payment: payments[0] },
}

export const OpenMenu: Story = {
  args: { payment: payments[0] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole("button")
    userEvent.click(button)
    const menu = await within(canvasElement.ownerDocument.body).findByRole(
      "menu",
    )
    expect(menu).toBeInTheDocument()
    expect(within(menu).getByText("Delete")).toBeInTheDocument()
  },
}
